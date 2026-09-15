import { Peer, DataConnection } from 'peerjs';
import { GameState, WebSocketClientMessage, WebSocketServerMessage } from '../types';
import { QuizHostEngine } from './quizHostEngine';

export type TransportMode = 'websocket' | 'p2p' | 'broadcast' | 'local_host';

export interface NetworkCallbacks {
  onStateUpdate: (state: GameState, role?: 'student' | 'admin') => void;
  onJoinSuccess: (participantId: string) => void;
  onAnswerResult?: (result: { isCorrect: boolean; points: number; correctAnswers: number[]; explanation?: string }) => void;
  onError: (message: string) => void;
  onConnectionStatusChange: (isConnected: boolean, mode: TransportMode, detail?: string) => void;
}

export class NetworkService {
  private mode: TransportMode = 'p2p';
  private role: 'student' | 'admin' = 'student';
  private roomCode: string = '1004';
  private callbacks: NetworkCallbacks;

  // WebSocket references
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isWsAttempting: boolean = false;

  // P2P / PeerJS references
  private peer: Peer | null = null;
  private hostEngine: QuizHostEngine | null = null;
  private peerConnections: Map<string, DataConnection> = new Map();
  private clientConnection: DataConnection | null = null;
  private isHost: boolean = false;

  // BroadcastChannel for cross-tab local communication
  private broadcastChannel: BroadcastChannel | null = null;

  // Pending join timeout
  private joinTimeoutTimer: any = null;

  constructor(callbacks: NetworkCallbacks) {
    this.callbacks = callbacks;

    // Initialize BroadcastChannel if available
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('whale_quiz_sync_channel');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastChannelMessage(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or error:', err);
      }
    }
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public setRoomCode(code: string) {
    this.roomCode = code.trim().toLowerCase();
  }

  public getMode(): TransportMode {
    return this.mode;
  }

  /**
   * Main connect method:
   * 1. If role is 'admin', and on Vercel / serverless (or when requested), become Host.
   * 2. Tries native WebSocket first if available and not explicitly disabled.
   * 3. Falls back to PeerJS P2P and BroadcastChannel seamlessly!
   */
  public connect(role: 'student' | 'admin', roomCode?: string) {
    this.role = role;
    if (roomCode) {
      this.roomCode = roomCode.trim().toLowerCase();
    }

    // Try WebSocket first (works on Cloud Run / Node server)
    this.tryWebSocketConnect();
  }

  private tryWebSocketConnect() {
    if (typeof window === 'undefined') return;

    // 1. vercel.app 도메인에서는 VITE_WS_URL을 전혀 사용하지 않고 PeerJS 모드로만 동작
    const hostname = window.location.hostname;
    const isVercel = hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
    if (isVercel) {
      console.log('[Network] vercel.app 도메인 감지됨: VITE_WS_URL을 사용하지 않고 PeerJS 모드로 동작합니다.');
      this.startP2PMode();
      return;
    }

    // 2. vercel.app이 아닌 경우: VITE_WS_URL이 있으면 사용하고, 없으면 현재 접속 주소를 기준으로 자동 설정
    // (https이면 wss://location.host, http이면 ws://location.host)
    const envWsUrl = ((import.meta as any).env?.VITE_WS_URL || '').trim();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultWsUrl = `${protocol}//${window.location.host}/ws?role=${this.role}`;
    const wsUrl = envWsUrl.length > 0 ? envWsUrl : defaultWsUrl;

    try {
      this.isWsAttempting = true;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const wsTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('[Network] WebSocket connection timed out. Falling back to P2P/Serverless Mode.');
          try { ws.close(); } catch {}
          this.startP2PMode();
        }
      }, 2500);

      ws.onopen = () => {
        clearTimeout(wsTimeout);
        this.mode = 'websocket';
        this.isWsAttempting = false;
        this.callbacks.onConnectionStatusChange(true, 'websocket', '웹소켓 서버 연결됨');

        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketServerMessage = JSON.parse(event.data);
          this.handleIncomingServerMessage(data);
        } catch (err) {
          console.error('[Network] Error parsing message:', err);
        }
      };

      ws.onclose = () => {
        clearTimeout(wsTimeout);
        if (this.mode === 'websocket') {
          this.callbacks.onConnectionStatusChange(false, 'websocket', '웹소켓 연결 종료');
        }
        // Fallback to P2P if WebSocket failed
        if (this.isWsAttempting) {
          this.isWsAttempting = false;
          this.startP2PMode();
        }
      };

      ws.onerror = () => {
        clearTimeout(wsTimeout);
        // Will close and trigger onclose fallback
      };
    } catch (err) {
      console.warn('[Network] Failed to initialize WebSocket:', err);
      this.startP2PMode();
    }
  }

  /**
   * Start P2P WebRTC Mode (Vercel & Serverless support)
   */
  public startP2PMode() {
    this.mode = 'p2p';

    if (this.role === 'admin') {
      this.initAsHost();
    } else {
      this.initAsClient();
    }
  }

  /**
   * Teacher / Host Mode in Browser
   */
  private initAsHost() {
    this.isHost = true;

    // Create local host engine if not exists
    if (!this.hostEngine) {
      this.hostEngine = new QuizHostEngine({
        onBroadcast: (publicState, adminState) => {
          // Send admin state to self
          this.callbacks.onStateUpdate(adminState, 'admin');

          // Send public state to all connected student peer data channels
          const payload: WebSocketServerMessage = {
            type: 'state_update',
            state: publicState,
            role: 'student',
          };
          this.broadcastToPeers(payload);

          // Broadcast via local BroadcastChannel
          this.sendBroadcastChannel({
            channelType: 'host_broadcast',
            payload,
            roomCode: this.roomCode,
          });
        },
        onDirectResponse: (participantId, message) => {
          // Send to specific student peer connection
          const conn = this.peerConnections.get(participantId);
          if (conn && conn.open) {
            conn.send(message);
          }

          // Broadcast channel response for local tabs
          this.sendBroadcastChannel({
            channelType: 'host_direct',
            targetParticipantId: participantId,
            message,
            roomCode: this.roomCode,
          });
        },
      });
    }

    // Immediately trigger initial state
    this.callbacks.onStateUpdate(this.hostEngine.getAdminState(), 'admin');
    this.callbacks.onConnectionStatusChange(true, 'local_host', `선생님 호스트 대기실 준비 완료 (방 코드: ${this.roomCode})`);

    // Initialize PeerJS Host
    this.initPeerJSHost();
  }

  private initPeerJSHost() {
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }

    const hostPeerId = `whale-quiz-host-${this.roomCode}`;
    console.log(`[Network] Starting PeerJS Host with ID: ${hostPeerId}`);

    try {
      const peer = new Peer(hostPeerId, {
        debug: 0,
      });
      this.peer = peer;

      peer.on('open', (id) => {
        console.log(`[Network] PeerJS Host online! ID: ${id}`);
        this.callbacks.onConnectionStatusChange(true, 'p2p', `P2P 방 개설됨 (방 코드: ${this.roomCode})`);
      });

      peer.on('connection', (conn) => {
        console.log(`[Network] New student incoming connection from peer: ${conn.peer}`);

        let assignedParticipantId: string | null = null;

        conn.on('open', () => {
          // Send current state to newly connected student
          if (this.hostEngine) {
            conn.send({
              type: 'state_update',
              state: this.hostEngine.getPublicState(),
              role: 'student',
            });
          }
        });

        conn.on('data', (rawData: any) => {
          try {
            const msg: WebSocketClientMessage = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (this.hostEngine) {
              const res = this.hostEngine.handleClientMessage(msg, assignedParticipantId || undefined);
              if (res.participantId) {
                assignedParticipantId = res.participantId;
                this.peerConnections.set(res.participantId, conn);
              }
            }
          } catch (err) {
            console.error('[Network] Error handling student peer message:', err);
          }
        });

        conn.on('close', () => {
          if (assignedParticipantId && this.hostEngine) {
            this.hostEngine.markParticipantOffline(assignedParticipantId);
            this.peerConnections.delete(assignedParticipantId);
          }
        });

        conn.on('error', () => {
          // Connection level error handled
        });
      });

      peer.on('error', (err: any) => {
        // If room ID is taken, we still work locally via BroadcastChannel!
        if (err?.type === 'unavailable-id') {
          this.callbacks.onConnectionStatusChange(true, 'local_host', `방 코드 활성화 (${this.roomCode})`);
          return;
        }
      });
    } catch (err) {
      console.warn('[Network] PeerJS initialization notice:', err);
    }
  }

  /**
   * Student / Client Mode in Browser
   */
  private initAsClient() {
    this.isHost = false;
    this.callbacks.onConnectionStatusChange(false, 'p2p', `선생님 퀴즈 방(${this.roomCode}) 연결 준비 중...`);

    // Ask local BroadcastChannel if host is alive on another tab
    this.sendBroadcastChannel({
      channelType: 'client_query_host',
      roomCode: this.roomCode,
    });

    // Start PeerJS client connection to host
    this.initPeerJSClient();
  }

  private initPeerJSClient() {
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }

    try {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;

      peer.on('open', (myId) => {
        console.log(`[Network] PeerJS Student client started. My Peer ID: ${myId}`);
        const hostPeerId = `whale-quiz-host-${this.roomCode}`;

        const conn = peer.connect(hostPeerId, {
          reliable: true,
        });
        this.clientConnection = conn;

        conn.on('open', () => {
          console.log('[Network] Connected to Host via WebRTC DataChannel!');
          this.callbacks.onConnectionStatusChange(true, 'p2p', `선생님 퀴즈 방(${this.roomCode}) 연결 완료`);
        });

        conn.on('data', (rawData: any) => {
          const msg: WebSocketServerMessage = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          this.handleIncomingServerMessage(msg);
        });

        conn.on('close', () => {
          this.callbacks.onConnectionStatusChange(false, 'p2p', '선생님 퀴즈 방과의 연결이 끊어졌습니다.');
        });

        conn.on('error', () => {
          // Connection level error handled
        });
      });

      peer.on('error', (err: any) => {
        if (err?.type === 'peer-unavailable') {
          // Expected when teacher has not opened the host screen yet
          this.callbacks.onConnectionStatusChange(
            false,
            'p2p',
            `선생님 퀴즈 방(${this.roomCode}) 대기 중`
          );
          return;
        }
      });
    } catch (err) {
      console.warn('[Network] PeerJS client initialization notice:', err);
    }
  }

  /**
   * Universal Send Message from Client / Admin to Server or Host
   */
  public sendMessage(msg: WebSocketClientMessage) {
    // If join message, set a 6-second timeout safety guard to prevent sticking on "접속 중..."
    if (msg.type === 'join') {
      if (this.joinTimeoutTimer) clearTimeout(this.joinTimeoutTimer);
      this.joinTimeoutTimer = setTimeout(() => {
        console.warn('[Network] Join response timed out after 6 seconds.');
        this.callbacks.onError(
          `선생님 퀴즈 방(코드: ${this.roomCode})에 연결할 수 없습니다. 선생님 화면이 켜져 있는지 확인해 주세요.`
        );
      }, 6000);
    }

    // 1. WebSocket mode
    if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return;
    }

    // 2. If Host mode (Teacher using local engine)
    if (this.isHost && this.hostEngine) {
      this.hostEngine.handleClientMessage(msg);
      return;
    }

    // 3. WebRTC PeerJS Client mode
    if (this.clientConnection && this.clientConnection.open) {
      this.clientConnection.send(msg);
      return;
    }

    // 4. BroadcastChannel fallback (same machine / multi-tab)
    this.sendBroadcastChannel({
      channelType: 'client_to_host',
      message: msg,
      roomCode: this.roomCode,
    });
  }

  private handleIncomingServerMessage(data: WebSocketServerMessage) {
    if (data.type === 'state_update') {
      this.callbacks.onStateUpdate(data.state, data.role);
    } else if (data.type === 'join_success') {
      if (this.joinTimeoutTimer) {
        clearTimeout(this.joinTimeoutTimer);
        this.joinTimeoutTimer = null;
      }
      this.callbacks.onConnectionStatusChange(true, this.mode);
      this.callbacks.onJoinSuccess(data.participantId);
    } else if (data.type === 'error') {
      if (this.joinTimeoutTimer) {
        clearTimeout(this.joinTimeoutTimer);
        this.joinTimeoutTimer = null;
      }
      this.callbacks.onError(data.message);
    } else if (data.type === 'answer_result') {
      if (this.callbacks.onAnswerResult) {
        this.callbacks.onAnswerResult(data);
      }
    }
  }

  private broadcastToPeers(payload: WebSocketServerMessage) {
    for (const [_, conn] of this.peerConnections.entries()) {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          console.warn('Error sending to peer:', e);
        }
      }
    }
  }

  private sendBroadcastChannel(data: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(data);
      } catch (e) {
        console.warn('BroadcastChannel send error:', e);
      }
    }
  }

  private handleBroadcastChannelMessage(data: any) {
    if (!data || data.roomCode !== this.roomCode) return;

    if (data.channelType === 'host_broadcast') {
      if (!this.isHost) {
        this.handleIncomingServerMessage(data.payload);
      }
    } else if (data.channelType === 'host_direct') {
      if (!this.isHost) {
        this.handleIncomingServerMessage(data.message);
      }
    } else if (data.channelType === 'client_to_host') {
      if (this.isHost && this.hostEngine) {
        this.hostEngine.handleClientMessage(data.message);
      }
    } else if (data.channelType === 'client_query_host') {
      if (this.isHost && this.hostEngine) {
        this.sendBroadcastChannel({
          channelType: 'host_broadcast',
          payload: {
            type: 'state_update',
            state: this.hostEngine.getPublicState(),
            role: 'student',
          },
          roomCode: this.roomCode,
        });
      }
    }
  }

  public destroy() {
    if (this.joinTimeoutTimer) clearTimeout(this.joinTimeoutTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }

    if (this.hostEngine) {
      this.hostEngine.destroy();
      this.hostEngine = null;
    }

    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch {}
      this.broadcastChannel = null;
    }
  }
}

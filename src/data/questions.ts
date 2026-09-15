import { QuizQuestion } from '../types';

export const ALL_QUESTIONS: QuizQuestion[] = [
  // 1. 우리 학교 관련 문제 (사용자 요청 문제 1~5, 1, 3, 4, 5)
  {
    id: 1,
    category: '우리 학교',
    question: '우리 학교가 지어진 날은 언제일까?',
    options: ['1929년 9월 6일', '1927년 9월 2일', '1929년 2월 6일', '1996년 8월 6일'],
    correctAnswers: [2], // 1929년 2월 6일
    points: 10,
    explanation: '우리 학교의 첫 설립 개교일은 1929년 2월 6일입니다! 오랜 역사와 전통을 자랑해요 🏫',
  },
  {
    id: 2,
    category: '우리 학교',
    question: '우리 록밴드의 부원은 몇 명일까?',
    options: ['7명', '8명', '6명', '5명'],
    correctAnswers: [0], // 7명
    points: 10,
    explanation: '우리 학교 멋진 록밴드 부원은 총 7명입니다! 🎸🥁',
  },
  {
    id: 3,
    category: '우리 학교',
    question: '한결이가 좋아하는 것은?',
    options: ['그림 그리기', '뛰어놀기', '자기', '밥 먹기'],
    correctAnswers: [0], // 그림 그리기
    points: 10,
    explanation: '한결이가 가장 좋아하는 것은 바로 창의적인 그림 그리기입니다! 🎨',
  },
  {
    id: 4,
    category: '우리 학교',
    question: '다음 중 4학년 학생들의 생일로 맞는 것은?',
    options: ['12월 13일', '5월 24일', '9월 19일', '12월 17일'],
    correctAnswers: [2], // 9월 19일
    points: 10,
    explanation: '4학년 학생들의 생일은 9월 19일입니다! 모두 축하해 주세요 🎂',
  },
  {
    id: 5,
    category: '우리 학교',
    question: '우리 학교의 여학생은 몇 명일까?',
    options: ['11명', '7명', '8명', '9명'],
    correctAnswers: [2], // 8명
    points: 10,
    explanation: '우리 학교의 소중한 여학생은 총 8명입니다! 👧',
  },
  {
    id: 6,
    category: '우리 학교',
    question: '우리 학교가 옮겨진(이전한) 날은 언제일까?',
    options: ['1992년 3월 18일', '1994년 3월 18일', '1993년 3월 18일', '1993년 3월 17일'],
    correctAnswers: [2], // 1993년 3월 18일
    points: 10,
    explanation: '현재 학교 자리로 이전한 뜻깊은 날은 1993년 3월 18일입니다! 🚚',
  },
  {
    id: 7,
    category: '우리 학교',
    question: '총 졸업생 수는 몇 명일까?',
    options: ['2,583명', '10,036명', '4,988명', '5,889명'],
    correctAnswers: [1], // 10,036명
    points: 10,
    explanation: '지금까지 우리 학교를 빛내며 졸업한 선배님들은 총 10,036명입니다! 🎓',
  },
  {
    id: 8,
    category: '우리 학교',
    question: '우리 학교에 안경 쓴 학생은 몇 명일까?',
    options: ['4명', '3명', '5명', '2명'],
    correctAnswers: [2], // 5명
    points: 10,
    explanation: '우리 학교에서 똘똘한 안경을 쓴 친구는 5명입니다! 👓',
  },
  {
    id: 9,
    category: '우리 학교',
    question: '우리 학교 전교 회장의 이름은?',
    options: ['전주현', '박한결', '안유빈', '이은서'],
    correctAnswers: [2], // 안유빈
    points: 10,
    explanation: '멋진 리더십으로 학교를 이끄는 전교 회장의 이름은 안유빈 학생입니다! 🌟',
  },

  // 2. 초등 과학/역사/시사 문제 (정답 2개인 경우 점수 2배 = 20점)
  {
    id: 10,
    category: '과학',
    question: '[정답 2개 - 점수 2배!] 식물이 햇빛을 받아 광합성을 할 때 필요한 요소를 2개 고르시오.',
    options: ['햇빛', '이산화탄소', '설탕', '플라스틱'],
    correctAnswers: [0, 1], // 햇빛, 이산화탄소 (정답 2개)
    points: 20,
    explanation: '식물은 잎의 엽록체에서 햇빛과 물, 이산화탄소를 이용해 스스로 양분을 만듭니다! (정답 2개로 20점 획득!) 🌱',
  },
  {
    id: 11,
    category: '역사',
    question: '[정답 2개 - 점수 2배!] 조선 제4대 왕인 세종대왕의 위대한 업적 또는 발명품 2가지를 고르시오.',
    options: ['훈민정음 창제', '측우기 발명', '거북선 건조', '수원화성 축조'],
    correctAnswers: [0, 1], // 훈민정음, 측우기 (정답 2개)
    points: 20,
    explanation: '세종대왕님은 훈민정음(한글)을 창제하시고 장영실 등과 함께 측우기, 해시계를 발명하셨습니다! (거북선은 이순신 장군, 수원화성은 정조) 📜',
  },
  {
    id: 12,
    category: '과학',
    question: '[정답 2개 - 점수 2배!] 태양계 8개 행성 중 지구보다 태양에 더 가까이 있는 행성 2개를 고르시오.',
    options: ['수성', '금성', '화성', '목성'],
    correctAnswers: [0, 1], // 수성, 금성 (정답 2개)
    points: 20,
    explanation: '태양에서 가까운 순서는 수성 - 금성 - 지구 - 화성 - 목성 - 토성 - 천왕성 - 해왕성 순입니다! 🪐',
  },
  {
    id: 13,
    category: '시사',
    question: '[정답 2개 - 점수 2배!] 지구 온난화를 막고 기후위기를 극복하기 위해 초등학생이 실천할 수 있는 2가지를 고르시오.',
    options: ['안 쓰는 전등 끄기', '텀블러나 다회용기 사용하기', '양치할 때 물 계속 틀어놓기', '비닐봉지 매일 여러 장 쓰기'],
    correctAnswers: [0, 1], // 안 쓰는 전등 끄기, 텀블러 사용하기 (정답 2개)
    points: 20,
    explanation: '에너지를 절약하고 일회용품 대신 다회용기를 쓰는 것은 지구를 지키는 가장 멋진 실천입니다! 🌏',
  },
  {
    id: 14,
    category: '역사',
    question: '우리나라의 고유 영토이자 동쪽 끝에 위치한 아름다운 섬 \'독도\'가 속한 행정구역은 어디일까요?',
    options: ['경상북도 울릉군', '강원특별자치도 강릉시', '제주특별자치도 제주시', '전라남도 완도군'],
    correctAnswers: [0], // 경상북도 울릉군
    points: 10,
    explanation: '독도는 대한민국 경상북도 울릉군 울릉읍 독도리에 속한 대한민국의 고유 영토입니다! 🇰🇷',
  },
  {
    id: 15,
    category: '과학',
    question: '물이 주전자에서 보글보글 끓어 100도씨에 수증기(기체)로 변하는 상태 변화를 무엇이라고 부를까요?',
    options: ['기화', '응결', '융해', '응고'],
    correctAnswers: [0], // 기화
    points: 10,
    explanation: '액체가 기체로 변하는 상태 변화는 \'기화(Vaporization)\'라고 부릅니다! 💧➡️💨',
  }
];

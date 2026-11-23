// 학과 고정 목록 — 자유 입력은 받지 않습니다(FR-11).
// TODO: 학교 홈페이지 학과 목록을 기준으로 실제 학과명으로 교체해야 합니다. 지금은 예시 목록입니다.
export interface Department {
  code: string;
  name: string;
  college: string;
}

export const DEPARTMENTS: Department[] = [
  { code: "KOR", name: "국어국문학과", college: "인문대학" },
  { code: "ENG", name: "영어영문학과", college: "인문대학" },
  { code: "HIS", name: "사학과", college: "인문대학" },
  { code: "PHI", name: "철학과", college: "인문대학" },
  { code: "ECO", name: "경제학과", college: "사회과학대학" },
  { code: "PSY", name: "심리학과", college: "사회과학대학" },
  { code: "MED", name: "미디어커뮤니케이션학과", college: "사회과학대학" },
  { code: "PUB", name: "행정학과", college: "사회과학대학" },
  { code: "BIZ", name: "경영학과", college: "경영대학" },
  { code: "ACC", name: "회계학과", college: "경영대학" },
  { code: "MAT", name: "수학과", college: "자연과학대학" },
  { code: "PHY", name: "물리학과", college: "자연과학대학" },
  { code: "CHE", name: "화학과", college: "자연과학대학" },
  { code: "BIO", name: "생명과학과", college: "자연과학대학" },
  { code: "CSE", name: "컴퓨터공학과", college: "공과대학" },
  { code: "SWE", name: "소프트웨어학과", college: "공과대학" },
  { code: "AIE", name: "인공지능학과", college: "공과대학" },
  { code: "EEE", name: "전자공학과", college: "공과대학" },
  { code: "MEC", name: "기계공학과", college: "공과대학" },
  { code: "CIV", name: "건축공학과", college: "공과대학" },
  { code: "CHM", name: "화학공학과", college: "공과대학" },
  { code: "DES", name: "시각디자인학과", college: "예술대학" },
  { code: "IND", name: "산업디자인학과", college: "예술대학" },
  { code: "MUS", name: "음악학과", college: "예술대학" },
  { code: "EDU", name: "교육학과", college: "사범대학" },
  { code: "NUR", name: "간호학과", college: "간호대학" },
];

export function findDepartment(code: string | null | undefined): Department | undefined {
  return DEPARTMENTS.find((d) => d.code === code);
}

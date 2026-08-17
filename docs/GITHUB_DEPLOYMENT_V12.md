# GitHub 업로드 및 배포

## 1. GitHub에서 저장소 만들기

GitHub에서 New repository를 선택합니다.

예:
`car-simulator`

처음 저장소를 만들 때 README, .gitignore, License를 자동 생성하지 않아도 됩니다. 로컬 V12에 이미 포함되어 있습니다.

## 2. V12 압축 해제

V12 압축을 원하는 폴더에 풀고, 그 폴더에서 터미널/Git Bash를 엽니다.

## 3. Git 초기화

```bash
git init
git branch -M main
```

## 4. 파일 추가 및 첫 커밋

```bash
git add .
git commit -m "Initial CAR SIMULATOR V12"
```

## 5. GitHub 저장소 연결

GitHub 저장소의 HTTPS 주소를 복사합니다.

```bash
git remote add origin https://github.com/YOUR_USERNAME/car-simulator.git
```

확인:

```bash
git remote -v
```

## 6. 업로드

```bash
git push -u origin main
```

GitHub 페이지를 새로고침하면 파일들이 올라와 있습니다.

## 7. GitHub Pages 켜기

저장소에서:

Settings
-> Pages
-> Build and deployment
-> Source
-> GitHub Actions

를 선택합니다.

V12에는 `.github/workflows/pages.yml`이 들어 있으므로 `main`에 push하면 Pages 배포 workflow가 실행됩니다.

## 8. 주의

현재 V11/V12의 맵 서버는 Node.js + Express + SQLite입니다.

GitHub Pages는 정적 파일 호스팅이므로 이 서버를 실행하지 않습니다.

따라서 Pages 주소에서는 `/api/maps`가 동작하지 않습니다.

즉:

- 시뮬레이터의 정적 기능: Pages에서 테스트 가능
- Node API를 통한 맵 저장: Pages에서 불가능
- 실제 서비스: Node.js 서버를 별도 호스팅해야 함

## 9. 다음 서버 배포 단계

실제 인터넷 서비스로 만들 때는:

GitHub
  -> backend host
  -> Node.js/Express
  -> PostgreSQL 또는 persistent database

구조로 옮기는 것을 권장합니다.

SQLite는 단일 서버의 초기 개발에는 적합하지만, 여러 인스턴스/확장성을 고려하면 이후 PostgreSQL로 전환하는 것이 좋습니다.

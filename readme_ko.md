# CarMediaHub 플러그인

상태: v0 초안

언어: [English](readme.md) · [简体中文](readme_zh.md) · 한국어

CarMediaHub 플러그인의 공개 디렉터리 구조와 패키지 거버넌스 경계입니다.

## 분류

| 분류 | 범위 |
|---|---|
| [Core 동반 플러그인](plugins/core-companion/readme_ko.md) | 플랫폼 공통 capability 예시 |
| [공식 플러그인](plugins/official/readme_ko.md) | 조직이 유지 관리하는 패키지 |
| [어댑터](plugins/adapters/readme_ko.md) | 범위가 제한된 프로토콜/서비스 어댑터 |
| [브라우저 브리지](plugins/browser-bridge/readme_ko.md) | 취소 가능한 이름 지정 브리지 세션 |
| [커뮤니티](plugins/community/readme_ko.md) | 선별된 서드파티 패키지 |

카탈로그 메타데이터는 [`catalog/plugins.json`](catalog/plugins.json)에 정의되어 있습니다. SDK가 패키지 매니페스트와 공개 capability 계약을 정의합니다.

## 기여 경계

패키지는 ID, 게시자, 경로, capability, 리소스, 데이터 수명 주기와 SDK 호환 범위를 선언합니다. Core 내부 모듈을 가져오거나 원시 호스트 경로, 데이터베이스 자격 증명, 복사된 브라우저 프로필 데이터, 터널 내부 정보 또는 선언하지 않은 네트워크 접근을 사용해서는 안 됩니다.

패키지를 제안하기 전에 [기여 초안](contributing_ko.md)을 읽어 주세요.
# CarMediaHub 플러그인

이 저장소는 공식 플러그인, Core 동반 플러그인, 상류 어댑터, 브라우저 브리지와 커뮤니티 플러그인을 함께 관리합니다. 각 플러그인은 매니페스트, 소스, 테스트와 다국어 문서를 독립적으로 가집니다.

`pnpm build`는 Core staging 설치기가 사용할 수 있는 `dist/packages/<plugin-id>` 패키지를 만들고, `pnpm verify:packages`는 매니페스트와 컴파일된 진입점, UI 및 문서 구성을 검증합니다.

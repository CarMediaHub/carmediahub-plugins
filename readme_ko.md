# CarMediaHub 플러그인

상태: v0 초안

언어: [English](readme.md) · [简体中文](readme_zh.md) · 한국어

CarMediaHub 플러그인의 공개 디렉터리 구조와 패키지 거버넌스 경계입니다.

## 분류

| 분류 | 범위 |
|---|---|
| [Core 동반 플러그인](plugins/core-companion/readme_ko.md) | 플랫폼 공통 capability 예시 |
| [공식 플러그인](plugins/official/readme_ko.md) | 조직이 유지 관리하는 패키지 |
| [어댑터](plugins/adapters/readme_ko.md) | 범위가 제한된 로컬 서비스 및 상류 프로토콜 어댑터 |
| [브라우저 브리지](plugins/browser-bridge/readme_ko.md) | 취소 가능한 이름 지정 브리지 세션 |
| [커뮤니티](plugins/community/readme_ko.md) | 선별된 서드파티 패키지 |

카탈로그 메타데이터는 [`catalog/plugins.json`](catalog/plugins.json)에 정의되어 있습니다. SDK가 패키지 매니페스트와 공개 capability 계약을 정의합니다.

각 카탈로그 항목은 `integrationKind`도 선언합니다. 허용 값은 `self-authored-media`, `core-companion`, `local-service-bridge`, `browser-session`, `proxy-compat`, `community`이며, 이는 소유권과 위험 경계를 나타내는 기계 판독 가능한 속성입니다. 폴더 이름으로 추론하지 않습니다.

마이그레이션 매트릭스와 공개 카탈로그는 의도적으로 분리되어 있습니다. 마이그레이션 항목은 `example` 상태이고 공개로 표시되며 `catalog/plugins.json`에 존재하고 검증된 패키지 빌드에서 생성될 때만 공개 패키지가 됩니다. 기존 site_gateway 어댑터는 보안 및 호환성 검토가 끝날 때까지 마이그레이션 메타데이터로만 유지됩니다.

패키지 빌드와 검증은 카탈로그를 기준으로 동작합니다. 공개 패키지를 추가하려면 카탈로그 경로, 일치하는 SDK Manifest, 선언된 Worker/Runtime 진입점과 세 가지 언어 README가 필요하며, 빌드 스크립트에 별도의 하드코딩 목록을 유지하지 않습니다.

## 기여 경계

패키지는 ID, 게시자, 경로, capability, 리소스, 데이터 수명 주기와 SDK 호환 범위를 선언합니다. Core 내부 모듈을 가져오거나 원시 호스트 경로, 데이터베이스 자격 증명, 복사된 브라우저 프로필 데이터, 터널 내부 정보 또는 선언하지 않은 네트워크 접근을 사용해서는 안 됩니다.

패키지를 제안하기 전에 [기여 초안](contributing_ko.md)을 읽어 주세요.
# CarMediaHub 플러그인

이 저장소는 공식 플러그인, Core 동반 플러그인, 상류 어댑터, 브라우저 브리지와 커뮤니티 플러그인을 함께 관리합니다. 각 플러그인은 매니페스트, 소스, 테스트와 다국어 문서를 독립적으로 가집니다.

`pnpm build`는 Core staging 설치기가 사용할 수 있는 `dist/packages/<plugin-id>` 패키지를 만들고, `pnpm verify:packages`는 매니페스트와 컴파일된 진입점, UI 및 문서 구성을 검증합니다.

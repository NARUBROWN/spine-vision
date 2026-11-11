# Spine Vision

Spine과 Spine Cloud의 제작 배경과 비전을 소개하는 웹사이트입니다. 3D 척추 모형을 돌려 보고, Spine의 요청 처리 단계와 Spine Cloud의 배포 흐름을 살펴볼 수 있습니다.

[Spine Vision 열기](https://spine-vision.vercel.app/)

## 로컬에서 실행하기

Node.js 22.12 이상과 npm이 필요합니다. 저장소를 내려받은 뒤 루트에서 실행합니다.

```sh
npm ci
npm run dev
```

[http://127.0.0.1:4175/](http://127.0.0.1:4175/)에서 사이트를 열 수 있습니다. API 키나 별도 서버 없이 동작합니다. 배포 흐름은 설명용이며, 실제 배포 요청을 보내지 않습니다.

## 빌드하기

```sh
npm run check
npm run build
```

Vite가 `dist/`에 정적 파일을 생성합니다. Vercel에서 이 저장소를 배포할 때는 저장소 루트를 사용합니다. 빌드 명령과 출력 경로는 [`vercel.json`](vercel.json)에 설정되어 있습니다.

## 척추 모델과 글꼴 출처

척추 모형은 BodyParts3D 4.0 데이터에서 척추뼈 24개, 천골 1개, 디스크 23개를 추출해 만들었습니다. 좌표, 크기, 재질과 파일 형식을 웹 화면에 맞췄습니다. 3D를 표시할 수 없는 환경에서는 같은 모형을 그린 이미지를 보여 줍니다.

- 척추 모형: [BodyParts3D 출처와 변환 내역](public/models/bodyparts3d/NOTICE.txt), [CC BY 4.0 전문](public/models/bodyparts3d/LICENSE.txt)
- 글꼴: [Noto Sans KR](public/assets/fonts/noto-sans-kr-LICENSE.txt), [Schibsted Grotesk](public/assets/fonts/schibsted-grotesk-LICENSE.txt)의 SIL Open Font License 1.1 고지

빌드에는 저장소에 포함된 모형을 사용합니다. 모형을 다시 생성하려면 Python 3을 준비하고, `npm ci`를 마친 뒤 다음 명령을 실행합니다.

```sh
mkdir -p qa/bodyparts-source
curl -fL https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip -o qa/bodyparts-source/bodyparts3d-4.0.zip
npm run model:build
```

생성한 파일은 `public/models/bodyparts3d/`에 저장됩니다. [`manifest.json`](public/models/bodyparts3d/manifest.json)에서 원본과 변환 결과의 SHA-256, 선택한 부위 목록을 확인할 수 있습니다.

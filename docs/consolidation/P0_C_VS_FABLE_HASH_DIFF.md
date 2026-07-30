# P0 C: vs Fable Source Consolidation Hash Diff

Generated UTC: 2026-07-23T23:01:22.1918664Z

Canonical: C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb
Fable snapshot: E:\fable_work\rah-midland

## Summary

| Metric | Count |
|---|---:|
| Canonical files | 8678 |
| Fable files | 8562 |
| Identical | 8450 |
| Same path, different content | 108 |
| Canonical-only | 120 |
| Fable-only | 4 |

## Fable-only files

- apps/web/app/about/page.tsx | 8036 bytes | SHA-256 ae8a921808de66e1d7bfedada4151a0b58aa8bb97afcefcfe481df974651cb54
- apps/web/app/book/page.tsx | 243 bytes | SHA-256 058333b2e26e4beafad79743f51e0ac66f2b7a0d9d30ac3c6f6de3df189d4b68
- apps/web/app/booking/page.tsx | 247 bytes | SHA-256 f0f1abf99fefb8398ce0a38ff12288b638f54451492834da0a659eb6640fcdf0
- apps/web/app/listings/page.tsx | 181 bytes | SHA-256 174e8cc1415f05b34f0017f22150a3eaa53790a56f10db5b598f6ac10c6d2ee5

## Same-path content conflicts

- .env.example | canonical 8f6447274fbae76377371728901a1e2fe52786a462d332a09b8f7925877e6820 | Fable 68fa2e2cf1ae32640323411d07714bd4b117662f75fcde827bbc87174b395193
- .github/workflows/ci.yml | canonical e25499f3d61af7f2fccfd5d4e71432915d53112782919a6c04cbc664ab73b47b | Fable 31cdc6c4dcb13cda22ed5d3c2a8475e56bfa52a3ffc273c512d75b7cb0cc6a2d
- apps/desktop/package.json | canonical b785182b50bf2345c7e019bb91520b69ac5e73fb6e6e591b7d59b1edf1a340dd | Fable ab54d0a999d65480fbb129fac58c208b35226fcc3abe8ac10ba07266b7101207
- apps/mobile/.env.example | canonical ea3aff561168908b97c10cd92209628f5efe61511dd1c83c7229e633cf57d1b3 | Fable 45950e039c5f6834323d7670e68804b9a7fada6bb5e2b0bed7bf2a68547956b4
- apps/mobile/App.tsx | canonical afb06de676924d9e6ec152f50d759e17f5fb76fe084165f2e5a15555b8a7ff75 | Fable bf7e02622d7c38ed4b2b1c3a57420d776b61e3b36b1d74541ec6c7737fbf23b2
- apps/mobile/package.json | canonical 209b761d92ec01153919d1d24ce1e022e8f7d6e4c806f359650dfb31d38815d4 | Fable 252feb6bb9782ec6b3a8835236bf7df670fc846d9cc8fa3ffdb74ecb5664e870
- apps/mobile/src/screens/IssueReportScreen.tsx | canonical 8c0dcdee5926028d254f2ca792e150f232c4bd50e96dc11acfc8720c8e644068 | Fable 4eb50fd26d4310bf28e228e63a0349635f928bf443e5079db4509eb4b0ecd92e
- apps/mobile/src/screens/owner/BookingDetailScreen.tsx | canonical db37fdfc03a74f96a3a14abb13b60ff87ff48a44224f8ff650c61fd21c4db0c6 | Fable 73687c00f38d993013de2aac7f9952d3df1fe2e1fbebe445c5dc70511153988e
- apps/mobile/src/screens/PhotoCaptureScreen.tsx | canonical dc3eaed0f5b4710db293b6be486c110ee84bfed1da1543777b8440a4ecdfdf9c | Fable d409495b220717f278a9ae8a92ac5135a106416a4285f8b191c90239dd53b861
- apps/mobile/src/screens/ProfileScreen.tsx | canonical a7c3001381315df0403fefd3e8224f1ed2247451d8f9c4af1025d95383182218 | Fable 2a689c1fd0742356b6c85d1abedf3e0288c42b09406776706566821873ee00e8
- apps/mobile/src/screens/PropertyScreen.tsx | canonical 36dc71a5db298f5df8f6344a3e79a50d52c967605e313d9bea723b03e8037186 | Fable 08e7936bf8b117a251d3cda15d91b97febfb69eb40c59e0ebfab33cc4ab4b818
- apps/mobile/src/services/auth.ts | canonical e511008462c62daaa9ccbbcfbfaf7306c6bccc1176839bfa0fdc16afb5a42cf3 | Fable 27df1fb5aadf0d3459c513b07635b5f25d53b244b895bbb0a38b4375f373552e
- apps/mobile/src/services/camera.ts | canonical b35e33de3dd5f04f33c0d422b9ab6f550ece0af9138387bf9a847992289d2303 | Fable 501d487e9777f14e33a44ceefb1bd132d672c6b528dc390ddf2ee2c6a6fc4dea
- apps/mobile/src/services/database.ts | canonical b06c6cd55184d74616317e23ccda15a80f779568eed615d2105f1b76428f1a7b | Fable 0f57feb4c205128e64d192181cf28858eb53cb3abf55330aa31819e7292aa9b9
- apps/mobile/src/services/notifications.ts | canonical d76ee538d63de1a36f76beec103c66f9f290de324cc22dd774c3af4a4f8babb0 | Fable a8bf8ee3a0e9aaa98b705a17912089b4073b2082f1736e52cb9032b988d0229d
- apps/mobile/src/theme/colors.ts | canonical a5c2b9789c25ff0544f1cb3282a1ffa5785c61ae0f68b0358db51f6abde71699 | Fable 55aa6a031aef48a2a48632e55acf0471e3c7b1eef08a8deca2b7e4bba45ed0cd
- apps/web/.env.example | canonical 8b7daa0cf9e633cd5142ee91bfcc232753af7c17003444618dd6ad71f3be1a49 | Fable 7c010e565729e2c291a888a959c8e593da7815ff44ecf6b475ca0d2d65f8a661
- apps/web/app/api/admin/property-info/route.ts | canonical a0a1c93037ac10109050ff10eda1159cf0b49c1124e29b2bbd1d63c002059905 | Fable 90307e7ae13b25f3ccbaa77e4f4d6e3831e1e695bae52dfa285e2c7d9d97b91d
- apps/web/app/api/bookings/calendar/route.ts | canonical 957e1d64cac51e250cad1a91ac0cf98eddcbc8620aaf062b9791acf29a892da6 | Fable 90a31107b727d9719eb8a840feebf36fccb824c74ee38b3c845732ae761b99d9
- apps/web/app/api/bookings/sync/route.ts | canonical a475c7210eaacd1c1c38e74a8e2267e25f1877f1bbcabce8110b434793b5491e | Fable e0efd7332cf649bd128628e0c308ee1abaf4ece77b1c688a2410f1a9c199d01f
- apps/web/app/api/concierge/route.ts | canonical 11df2cee7d73ae5f8791075f7fe30311561c4f1ef0bb4e2c3b6f6f46d60a0231 | Fable 36f4933124cd6c4278755bc03588c1f7eccf61bc962e9b307593b082adb8daee
- apps/web/app/api/cron/guest-messages/route.ts | canonical 141b8b5af98efbc3e3a07d457bc1e008d8484b93f960504958d5b4505dde56df | Fable fe119be21eb27a00ed50c1d45ebd8828d2b0f02346d053aea38a07364f994986
- apps/web/app/api/cron/vrbo-sync/route.ts | canonical 344d119ea91ab1fd058b49d45dc202cf07c6261264f0449241986f40e3efbc16 | Fable 1b2a55a5425d7ed256453c36819c4b03716a8c54bd83da8db1695c27fc5cd851
- apps/web/app/api/dispatch/employees/route.ts | canonical 57d2749b8765cbedad1748a1ac719051f762bbe6ade4fc7f833c8cbb19ee884a | Fable eb8c3b5c478e0f61e4acee1c7b71198f4e6e613f97a489d36d6d5b34bb41607a
- apps/web/app/api/dispatch/tasks/[id]/route.ts | canonical e5b57c19d514f298f48f936056366a8ddb744e9c38ab34d43b885fbfec240abc | Fable 83d3ee34b3bda38ee819fe8c207cb420fb4cd8cf3e44ee58d798f2fd1608de60
- apps/web/app/api/dispatch/tasks/route.ts | canonical 218c5d4c289058b149d46175b1da03d1aeb35230da9eb2195f62b2899a97490d | Fable 326dd8f8277d9e0a2dbbc7a27591f9d9dfbe1a90f7806ffa0fcd373bfe6817cc
- apps/web/app/api/email/send/route.ts | canonical 59698f28c2e0698cb6275b41456d9dd68b3a97fad767fbd5f5018102a4309e36 | Fable e93a699c506a2a4d3c39145bba0a7b96cad666f0fb756febfef16ee4f771427f
- apps/web/app/api/health/route.ts | canonical 11e9fc819f0f1f07486cd898331566bd28d8d95dc9e0510af151b6f0fa8166ef | Fable 246531f994bb718d853cea3b0efb3e8276943e7cb5cf4cb1d8c79d5ea86fd2fd
- apps/web/app/api/integrations/paypal/balance/route.ts | canonical 4d2186d52abdd1174958ab2755927236b39df5c8b94d22a9477969e2f41a02a2 | Fable 19a4629e0ea7fe9308acea4822a6146c859aad71a114a1db0a283de5550bbc71
- apps/web/app/api/integrations/paypal/callback/route.ts | canonical 6adba2fc5d7284576ee99b2d58bc084a8b76096450e485a6436d60391bda47a3 | Fable eff5fb5e6141502272c381f68471eb9850c4a1b1d50d2e8f47e82adc4176b035
- apps/web/app/api/integrations/paypal/transactions/route.ts | canonical 3a9a79d807445146ebe9d935cc7bd3e1c779ba0c29901350cf8d32a54cd6c5a8 | Fable dc0c40e4f3d3695f83bec39fb76325b8be1caa885e02ead7ad5c8bcd6e24ca29
- apps/web/app/api/messages/automated/route.ts | canonical 52ff3c4a5792fd084ffc3492140daf526974b9c35235a727c10836d842e2b1be | Fable bb710a3222b25385583dda9d538aace889efa57e7c4b894f3510d31f23ff879e
- apps/web/app/api/properties/new/route.ts | canonical 62c49a817a67e495d1c58a92f7eae5977998b0b8212db4329d71de4bbce4806d | Fable 69b34bbd1ed1117c6d03d5cb49f58a39ee80632c9a7825caa33b0b36c511ab5e
- apps/web/app/api/smart-home/locks/route.ts | canonical ee6b34e2f97f08b81521c8f78f39885f6097f5f7d9a5b03e26b56175aa397722 | Fable 29d0f8d96d2204d5a697b2613e6a7f8d45d898661d81d0efef02c24a9296601f
- apps/web/app/api/smart-home/route.ts | canonical ee6b34e2f97f08b81521c8f78f39885f6097f5f7d9a5b03e26b56175aa397722 | Fable 31f2530ba272e0b3acbf0c6724d9987ccfea99fdf14d8cd4b49d1c3798e841c0
- apps/web/app/api/webhooks/vrbo/route.ts | canonical 7306b04e356b621eb1577cb61cae36c4247aa63caa715b08709ef6504f1e7baf | Fable b2ff047b6ba2682b0948a651a6d238336230cf427c715a9de69b1d53c0577a06
- apps/web/app/bookings/page.tsx | canonical d6ab197691c13817dff0572411631636d36d93d4f912f0c9c927a4e7e621d19e | Fable 484624a21803a0b12f38ccdabb3e87226a155e675913cf230d59208896755f21
- apps/web/app/dashboard/page.tsx | canonical d38fc6b18daf46a93c1808f99188705d6314953dbdd68c9943e76612ac3e2203 | Fable b6f141d64deeb2746ed7e3a05cd099444e64f17299d7aeeb0b058bb2de4a8153
- apps/web/app/dev-login/page.tsx | canonical c3e3b2192c330e43547baa49e111ebf8f04d1e131c688d58fcc467c9b426fdd3 | Fable 87db50bb528b9f8652fea2e1918a2c1bfed1ea88c8a7f85bb1c708a260c1031b
- apps/web/app/owner/page.tsx | canonical 42ad306937b9a3e4222f4e81bef505e0ac0783648003033df8569e908f8d18d6 | Fable b062fcdb3da7de23f0a8347a391332040c9dbc6b5bdcb241b68b875dc1015a2c
- apps/web/app/providers.tsx | canonical 7f649be4c3cba0748ca28a353b0e16952b6714a5e1a0234c75310320ed11087a | Fable 9dec7b9ba764946eac6ae790fe0831d3843647aea665ce8a440e98d612138f1d
- apps/web/middleware.ts | canonical f79e31af99e2e1011c9f3a4188e47e260e693b84a250871de533cd93132e96cd | Fable de551757b023d979f5789e8f280151e161d4c820411dd5f05a28523d6eba02c5
- apps/web/prisma/schema.prisma | canonical 83c46c44a1ee014aa7e65f9ce6378066b38c232bac145bfd40ed1c135ba636d4 | Fable 4f85d6c30d69e21afec2747d520f61ab6bbb0de4c40073bd7bfaa8c00c427c9e
- apps/web/src/components/AIConcierge.tsx | canonical 2a5769ee99c88c13d53845d215590fd21c86233514722e6dd05a875d565f08dc | Fable 2e8736afef0e9210d63a32a20e8a39dac0617391f1507de102f0b82bb21b207d
- apps/web/src/components/ChatWidget.tsx | canonical 28380f900934d7b6e9e57d973b1fa2ef1f1289a8cef9978e655216f901dd3180 | Fable 33d803df6d3716cecf39d4694ac315106ceabb60c6c79756ae659886a91b2a74
- apps/web/src/context/AuthContext.tsx | canonical 10b3137b721ffe4f2c1c3c6a35dc53467bfe97041d8e07b88f2e591467fbcb2d | Fable eb9cb94ffa96a414b21c131ca99ece51c2b0400c10198b99e1e3382ca079ce44
- apps/web/src/lib/ai-concierge-brain.ts | canonical 3d225dcba527fa98700e2f4a05dd11a2b33572fd5759d3289f34632280ddd2d4 | Fable ae9daf51d38f6b1b4aa6719dedd2d7f6d045508318e01ab0ea6f0fa8ebe3cdf7
- apps/web/src/lib/api-auth.ts | canonical a7fd1a4621e8e77510e591dad6068ffce04246f64c3eb35fcae9822198b09bbe | Fable 7429d716eea0351e992cbcb0550cecfbb7a9471803f2472073e0f8528d3252df
- apps/web/src/lib/auth.ts | canonical 675554b7b890e42083163507d5e3464b813e055fa02156feaf255b32da43bf9e | Fable a79cc3be7a9f5d1db5b4d88ae85be724bca67575bc9f0c3fe71c10683ab56493
- apps/web/src/lib/checkin-checkout.ts | canonical 12e9ca9989931e282435a03e5e341a2c33fb9b8af38f124d0c86de74312917ad | Fable 7bd7c3f67310c6ef48731ba714a5f6acbffd9c5390e64e301af0a5425a9781ae
- apps/web/src/lib/email-templates.ts | canonical b2d7e052d167aefe26e06341201fb916cb2290e11caeef3c1a5c7c5d64e59227 | Fable 80edf57555415acfc0b9a36780ba795969b42260b809b885dc07ccb513283aaa
- apps/web/src/lib/firebase-admin.ts | canonical 6a60fc7f67897132193d83b3f625f7f7906bcd1b973d0d955447cc9037cd4683 | Fable 373af5857be79f6fa3d91ca8e90afb2c430a3900b44d49bc425a1bdbf59c8a2b
- apps/web/src/lib/integrations/tuya-client.ts | canonical 84a0de15f85052bb115e50c4af661bed8d596d96026cba4665e9fc3d43f81c54 | Fable 5dcdcdcc389ce4e5bd53420c98f672b7c6c6d0a763397d8781a544270b5256c7
- apps/web/src/lib/integrations/vrbo-sync-service.ts | canonical 497386d1956b2acdfb55a96b8a873616d4053694d233e5a7f961f27b14305c02 | Fable 5c4e7f74764c42639c4ece845ce7e318724c4d0db281c7c6dbb99dcff69d88ed
- apps/web/src/lib/ownerrez-client.ts | canonical fefccd47da13ecae1bbdf8356f53825cff22f02c68c8ac4cfa0845c48ddf42b4 | Fable f6a472f00c10d17368735b039d5276e9afae6f5589045980e22c925bd255b822
- apps/web/src/lib/shared/firebase/index.ts | canonical aa7510a9c0151cae90e3dcfec3b9da56c63e999771a42a83575578a9e4af82f7 | Fable ae094ec3587a53b576e7ff591cd06a7303e9414b7d1bc8ae927f4609d4d110b7
- apps/web/src/lib/weather.ts | canonical b5cb984ed7c64b1356caf28da6509b9f630efb600c99132590e2c48870db4f16 | Fable 62d29038914c14f7490b0ea02f770814694a24fad09fb12e452e093cbb375adb
- apps/web/tools/sync-vercel-env.py | canonical c7a2bd16de957a1c56801d11bbebb5474c967685f5ecd280e73d7d0c740825cf | Fable 0ca024a7927a54928227be543c0b836688fb81f8a31f43c77196843f98052f72
- apps/web/tsconfig.tsbuildinfo | canonical d519fe65c1204d8377bd4828e1a767495fcead7027ec0adb567f7c4336be227d | Fable e110c07d2d8d21c1efc5a355978bf5a0d04e6cb70a8370316edcd032b9f8517f
- apps/web/vercel_env_output.txt | canonical 065ccb876ae137bd967613423e26a4f28b24fe4012029e65286afbdf0d76f26c | Fable 7aa49185cbce316cfe8587044a3e5b3922530985423e05ba9b57c86f8e060e3f
- apps/web/VERCEL_ENV_SETUP.md | canonical ad9ad361e724fe7b1d54c3a99652047194b62331b4b947f9c9c2c8da06f84fcf | Fable f24f321762c8a034735eb02ab5dca04e1be152a4b4ddcf623cb095376e0e5591
- backend/.env.example | canonical 1624428f3d6af8cdd7f55302ee94ae5f8a8f364e651b4c2638e06f158fc69574 | Fable 7d54acaf7cc539e5353b2540fc1ba9fa8d68244a067775ed4c5742b61f202f1d
- backend/.env.railway | canonical eed4c55de90540f26ffc17739b51bfde3e56770775b024861ca68e4c1b334608 | Fable 3f107947bd69a377fdc42f267bb7ca453d978e01e61ba528ebba20cb78c98473
- backend/ai/concierge.py | canonical 0d8b5c42287c6ddd9a2b67f4927c3d3d84410db2546122994d7f602aa2edab53 | Fable 62b80710af51ff411269ceb76a93f0c1aec0bf773516125c7406710c37197bb9
- backend/ai/voice.py | canonical 293f7d6005dc1667bd9689a3adca9fb680a73a3b346e6a2459b5c9929e1096c7 | Fable e46719502cb1b22f22f3431b12bfef48d446ed7624c9218c20a84efd1baf60fb
- backend/api/routes/concierge.py | canonical 7661fb714ae845ece9e98e78695a646be5838a7034294c1de9b98b37dcaf6771 | Fable 513109bc495e85d1679bce1152a681fa254b7aedc574439a2a924e416a1dd699
- backend/database/seed.py | canonical 42fe90522da15c6b9799c6d1c81390be6d5ae23a8e11acc588477fb074f1e530 | Fable fe45150b8c658858c304094dc8fc16f8de4b85426e57ba250e234b4029324742
- backend/routers/photos.py | canonical 3de0c95f10a2e4fa85dc3267a0396ade2d8bcdcb271c22bf28d3819205e68777 | Fable 9860e39f54683aa296c215008a0f94dd774a108380822bd3193559e5f9ec5fb8
- backend/routes/guest_portal.py | canonical 248391f54aa18b60297a02f7fd9286c0e369b76edb7c42f41d9cc16819afbad0 | Fable 5285d11b87928f78e34ae00dc721eaeae2fd8a360881a9adbc6fcec502a82bbd
- backend/services/concierge_kb.py | canonical 05474fed472d06cc1c197dffd6c7ae34ebac93e5a5b1ba27b32f55cd986ad09a | Fable 9936401369e2bca009b0216683d69547b409be85b70cc49edfd73d38e7d1f503
- backend/services/concierge_upgrades_v2.py | canonical 9aea9c1b1b827a7840ecd508b92575c9227226366cb4443b63d6026de034d47d | Fable e7440537e62366adb74b95e23d3b0e1a0e31b5e4d8d6c4380165dd0dc33b6567
- backend/services/steven_ai.py | canonical 8990c8bdce3089d9dd392ad312e82e10b8fb3e7aca866d938312f54d98971f11 | Fable 04f04d8ebf539d7f199d31bd5b277017ef2e5435f0df797abf0be1237d12f2e9
- backend/services/webhooks/vrbo_webhook.py | canonical 90ccad618cd30934d5b0fc820acebc47c6adaa10b687674a87473f09cd33a6e4 | Fable 4921498bddcd31f8343df4175c05afa6ff15f1165421d06bab26084d5b68f1c9
- deploy.ps1 | canonical b42346bd7344db87374aa937563c3c70fb795a17735afacbc8ba20fb8c408bc9 | Fable fc67bc3201dc27df6fb5fe5e67c8437797a0e06a5950727a2028901fb48fc5c2
- packages/ai-concierge/src/concierge.ts | canonical 2540cf6582f5d1e9aebed33bdcac06e02fe72d68315674c389933ac2ff0de989 | Fable 191a733e357ca62b152e49e3694e1976f6eb9f16b53e7c4d142bc6ad4c358818
- packages/analytics/src/occupancy-calculator.ts | canonical 638a8681687219c0fe55a670934ef7a109a4e957be0cf7e433eeb52c7128d3d3 | Fable 3aea2e2d161d1665654b8babe1fcc4b50b021d68a91eafb82c65d657e74033ec
- packages/analytics/src/revenue-tracker.ts | canonical 6553ef934e1c4fbc00001c4fa0f837653dda77483ae9980b2f5e7cd3555cc978 | Fable 9a51aa518965d4b0692a82965372bbc3b8880fc061a07650b0e2d811d48633a8
- packages/cloud-sync/package.json | canonical 2b726f49037db8155bf3831d96a95a6e2a423acbc06c83985ded5b395495024b | Fable ca61a7c6092dfc051877d98dbd42cc620863ef3df06039fc174298fcb1e20b82
- packages/cloud-sync/README.md | canonical fb92ba11ce7e1ab2569b5d07f9719489134c9cf9dcbee8b2bd8c3cd1009853e0 | Fable 5b69f4d16887a036bbfb67b42f66a3ab727c42240fe7f036cd1483864ec6cb0d
- packages/cloud-sync/src/cloud-sync.ts | canonical 66f81955823c0a9cd8bf44cf1505468215e36164c9fdce9d6f5bbecd5f997bbc | Fable 1d09aa29ea720d78426aa31405a2404ed64b4a51a67ede31fba423f7298bb519
- packages/cloud-sync/src/firebase-config.ts | canonical a6a467bd5ff4d67c03394a4e7f9f717a2446980c66cb1d428eef456ec7da581d | Fable 957751d8457db7d7b72553a299254c848654bbd1a080f1e7b70d4360dd2dc882
- packages/cloud-sync/src/hooks.ts | canonical b67321b847a915364451fbd72cde41b865e549daec0c4ce848a158b838c993cc | Fable 8c9653c3bea8d3ce891cf2f84dbfbc20ba73fa1dd4ea44db25c95fa7a6a594d3
- packages/cloud-sync/src/offline-queue.ts | canonical 3d4e96b976fd1c38617b256738c157d1303b985c83ca8dc14c52cd23ec7bfff9 | Fable 7ecd0283a72809f02b11c9b0621adf0e8f746992ba6848b27497978025a6f634
- packages/cloud-sync/src/prisma-adapter.ts | canonical 546a48d1ee165656f3cab933e793f691ccf75171cd1b8b290cf318a980389b90 | Fable 051e52507e3606c056f3f5b7d034aa56370862025275c31d05575c58db39cfcd
- packages/cloud-sync/src/sync-status-tracker.ts | canonical 5ae34eb49b795094af38b7828b9ac6d0595ff6edcf608ee2ef110cec8e8c8494 | Fable 2bad5a9c1f75410bfb08127115aa6fe1ad02b816cc63e2c30df1985a64d60e37
- packages/cloud-sync/tsconfig.json | canonical 58fd98124cf1d9860b43613f376f59c53f8d939085045e44dc1662d8e8a29630 | Fable ffcfe72c7cc659dc0687a81643b49dbc105904d4bf72f89992c50985d93b17da
- packages/messaging/src/scheduler.ts | canonical c56260289a997eaa3f19d41fba6a7f114964fcbf0ececffd1c2015cf5fd37874 | Fable dbe9275837ba7c1661f7d80013399be4e1f2477303fb0d50eec838e102665915
- packages/security/package.json | canonical 78918a97dd99035ac1dc6788b900c4071ce0ae7b29ec19a5bd40c6b82b7657a7 | Fable 29dad874c0070692dd0e8ea494c4aea0cc2c6deecdaa89a297c30a3a78a7557d
- packages/shared/package.json | canonical a82e8f771da0278d95371bd517be460cb093a2af2c22cf2ff5515540f282a3d3 | Fable ba46f196c530907f81aabc4917d9c06221ab1f74ae9fd45e8e8b6e7bc5ab75a1
- packages/shared/src/api/index.ts | canonical b60f9f434f5f7436dbd584417d1228b09b2acdfccc10b579bd9f68df1fd22f93 | Fable 925e0b511405d557b211a8b2ddbfa5db12481a9d51743541546921af3a9cea5e
- packages/shared/src/firebase/index.ts | canonical 31c2f2871c34663d1636c59db904b644ee3ee10f11af9943305658ac8df790fc | Fable ae094ec3587a53b576e7ff591cd06a7303e9414b7d1bc8ae927f4609d4d110b7
- packages/shared/src/sync/index.ts | canonical 911cc125e9a0399ccd587e9ca25eb356060149b445a40b186b9d21ed5191df8f | Fable a31abdccdb95691ab9880a408db7fd1c4610b3ddd5d4447ad33222dc30ee03d7
- packages/smart-locks/src/providers/august.ts | canonical d9b39114ec5f1b4ef6c585f172b562eb3eaac4b0834ed26a1dc4a488a824228d | Fable f19b2d0e0b42d0ccb7f124169a84cd9faaa031550dbca93a27aa47195dccbef9
- packages/smart-locks/src/providers/schlage.ts | canonical 22888ab1eb65f631c28ff8ef9b42c7a6c0cc3eeb58589a70de4d48ea48e637f1 | Fable a689098e525a0bc5957fa5e719d3317f6945683999ae7468c7b4581df24f9a9a
- packages/testing/integration/sync.test.ts | canonical 4ca8df008b05f7027e709b93a7cf17163fdf5f5c3f264d276cdfb9b8c711af38 | Fable af466e4b129de8c3b14e202b9905bf3d3fb02d0850b6412647c01a4fb2db3d92
- packages/testing/package.json | canonical 8203d0cdc2ca1799b267918d57bc0162ed30e7c2ae8ade5a9f175ce6f2681660 | Fable c2ac855e5236f59a47cdc36e52d91fc221caf3193fbb3075810763708e4fe121
- packages/testing/src/index.ts | canonical a4b68c1a846fcb647acf79472099df364f1e46284ad360fcff94ad8ef5c24fe3 | Fable b6440e3d21d0ad4430a906189ecd947a90edee9c9443f24c7ea63a309c486e85
- packages/testing/test-results/html.meta.json.gz | canonical 5662aa583a2bd8b96f41784066094c0686c18f97c2fb76bda72efbea8c735ea3 | Fable e0f281e22a90e29a9842298a06a58bc76f675f688c1c7312c0caca7b38636c04
- packages/testing/unit/formatting.test.ts | canonical 9298c48c92645723dfce53254693e52b25aac9c2f1370bf7790487b7dde63453 | Fable 83653fcec04962aaa9eb21c50f6b0d853c62fc82bc44fa883beaa3694724e093
- packages/testing/utils/fixtures.ts | canonical 96da0e23dd7e05fe94ef5ad1dae42b7d2e76bda955941c3118a41281b784bc3e | Fable 33734349efa9af0de0aac2e0d3a114675f05ebbaf134af3c502175431c0eea0d
- packages/testing/utils/mocks.ts | canonical 17b5e8110e00b37bc310e0165e4fe258c7894c8d922c4cf99ab6032a11d67bf8 | Fable 962fda3e8f4d97a4657c5fb3b6b9d82a5a3d9064b39a694655c53e916201bac6
- packages/testing/validation/validate-sync.ts | canonical 0bc0ab3409cf6715c47939f03d850ca0c3f497cec2df5f963befd41c4c59cfa0 | Fable 9302aad606d93b8c138db239f4599a20af1e4238b9fd8fb4961c092efb0d69fd
- packages/utils/package.json | canonical e344e388ccf0e8dd6349237d06cc04054dd7b76656e5011b263c519990f91552 | Fable e89376e8348179fce22b2da84cbcc8ccb1bd127086fe615dbdd5c3595a581f8a
- pnpm-lock.yaml | canonical 3d7dcb185d6062cf7bc5cebfd4ad3584aa73f81b0a230e549e0acfe0a060bdf6 | Fable 6747be13ac01cfe8f13da2f6e0bfe2bcb6b0ede57ac641c43bd4a2fd11a73fad
- prisma/schema.prisma | canonical 3a8baf7e3da553a1c92d0e9f3af9c6d23bed2ed6475eb88522bf33538bf9e2c4 | Fable 4f85d6c30d69e21afec2747d520f61ab6bbb0de4c40073bd7bfaa8c00c427c9e
- RAH_MIDLAND_PROJECT_STATUS.md | canonical 99f8d0b512c014b4356fce7669a0be3db4b2077bd13ba9af960138d6ef49b873 | Fable f4c6a40feb1f95901ff508b7ac69e5cbf2861fc42affe46ec975f7c8dba51eb9
- tools/vrbo_image_scraper.py | canonical 68ae4a042641e799ebdae68c24686568754253d56e064d4945057d529e3b8d2c | Fable 240acd8ca306183a5716f755c75c0f17396828fdbe24fd9e5ffba883ef2188f6
- turbo.json | canonical a633bc69701095560533aaf3257b61fdc06bb1c3314457b9572c3b474eca9fcb | Fable 3977f15a9fc84e138a2e11781c885b3089e502da9b4ee9c929cfcdf78d1c928f

## Canonical-only files

- apps/mobile/src/services/firebase-config.ts | 1161 bytes | SHA-256 56f9d590f382e6fbb439faeec43d5ff29e777a78b5d4de980031da561f8b9b1c
- apps/web/app/api/admin/vrbo-mailbridge/status/route.ts | 2796 bytes | SHA-256 ca34094ea9889e98f4e763c4daa419a9fff2779910a5c8e5afc68e09e387acf7
- apps/web/app/api/area-intelligence/route.ts | 857 bytes | SHA-256 a95a867229767e65300e92079ed35e8d9542a1eab5db46f863535a2cbe5b3778
- apps/web/app/api/cron/operations/route.ts | 1450 bytes | SHA-256 1080333a6d0a356451091eab5b8655c5f65542dda90d44163520d5f4648248d6
- apps/web/app/api/operations/dashboard/route.ts | 7907 bytes | SHA-256 f412f4fcc82709f5335a93588d9073f139f1455f1a18ccabfeb12005a282b980
- apps/web/app/api/operations/guest-requests/route.ts | 4231 bytes | SHA-256 ff5d37c0d0111fb7fe821432a7102176b925eeb9041667cc56b7cdc9ebffd5f1
- apps/web/app/api/operations/payroll/route.ts | 2394 bytes | SHA-256 ea8c4f77c386d53c89d04cbd3bd0956916eaddb27d7835b04ebc1a5d4dea1b78
- apps/web/app/api/operations/service-schedules/route.ts | 4192 bytes | SHA-256 7ead7065d8c4fd18584c6d34cd80f9a26b1a499625ec68dd996239bc04233c29
- apps/web/app/api/operations/work-orders/[id]/check-in/route.ts | 1320 bytes | SHA-256 275e79121bf11f009db3187c2864969812bcf09a4c7cdbb850a044ed5c78877e
- apps/web/app/api/operations/work-orders/[id]/checklist/route.ts | 1348 bytes | SHA-256 016908c2df89599502580b421a65e787d3ea37823e963e2ae22f7935bbf507a3
- apps/web/app/api/operations/work-orders/[id]/complete/route.ts | 1584 bytes | SHA-256 a1b665acae184c506f2aa725c7fcd8caa37f291016c14ae4d7ba4ce36411157e
- apps/web/app/api/operations/work-orders/route.ts | 3362 bytes | SHA-256 5121bbb34adc1613be7e23eea94e3e3163cea018588497dbf0799fc7b52b0510
- apps/web/app/guest/dashboard/page.tsx | 171 bytes | SHA-256 7d3efda23f672b12302dd0738cdc163c61aab7d490e8072d3d018d4a484d7e48
- apps/web/app/properties/layout.tsx | 253 bytes | SHA-256 d3a0dea9e21298a1db2d134352976d7ed9e0cdb43f527a74b84148904efe2668
- apps/web/app/properties/new/layout.tsx | 243 bytes | SHA-256 e2e60b86e4cf652411c3c1d1c5b065f6e45d5d3c770fe66d7ed73cbf07c2df1e
- apps/web/app/worker/page.tsx | 174 bytes | SHA-256 3479576815b7062fedc8ed1907b70eb1eb6147c89cd465d40276590aedd110d5
- apps/web/prisma/migrations/20260716190000_operations_foundation/migration.sql | 20299 bytes | SHA-256 e64fa9fcd1e3b2855ca231d90075350b5dca58e7681e9657d2393a0502012581
- apps/web/prisma/migrations/20260717120000_vrbo_mailbridge_shadow/migration.sql | 5569 bytes | SHA-256 27269cc4f47f6a8e3e3dc266011a0d0cdb08dd91e46c6b8573b43e610012431e
- apps/web/prisma/migrations/migration_lock.toml | 119 bytes | SHA-256 4fed45ce5bace4de7cfebd99562068f2a920c371439c9b85b8f5e510751787d6
- apps/web/src/components/operations/RoleDashboard.tsx | 27668 bytes | SHA-256 7747b03794bbfdbdc7a97906bea6d72fb9879d5511da17712f6df39cd5ae3bae
- apps/web/src/components/properties/PropertiesRouteGuard.tsx | 1628 bytes | SHA-256 fced8d0d8478a223eefc3a65df6c474dcbbe3a1d73a548c1c087d3984a27a7a7
- apps/web/src/lib/access-orchestration.ts | 10427 bytes | SHA-256 4840b49982e8e53ee5ad09e51fd818a5914dbf14ded4473bd68df30924404f22
- apps/web/src/lib/area-intelligence.ts | 12276 bytes | SHA-256 55a2f7b09f8a86a8a8949fe1f07c66a5d01b517335d2889bd41f7a31b3a78789
- apps/web/src/lib/firebase-client-config.ts | 3088 bytes | SHA-256 11756b6012d51975ff80191b1ec2726f0f319d52a1a95c4bcd3320a2c5dce355
- apps/web/src/lib/operations-auth.ts | 2288 bytes | SHA-256 3c39f2c63799fbcfe00c54a7a9ba1d7240222a839e8bf9b91c62632beefe45ba
- apps/web/src/lib/operations-policy.ts | 3703 bytes | SHA-256 c80e4adeece907559556e73d2a68542d2e1a56ebf1d65750ba55d19f9fd7190c
- apps/web/src/lib/operations-scheduler.ts | 8154 bytes | SHA-256 22fec22d2b4ff56c566d2668adb2ba1f22455f1bdebcc2e16a29a75f11c64c10
- apps/web/src/lib/operations-service.ts | 21006 bytes | SHA-256 870e9624903136e49a68e52a985791f135dd9e60a1f7aff9196a4aa7341580b9
- apps/web/src/lib/page-auth.ts | 978 bytes | SHA-256 8d7015f1ce75faab3b9015d9518d80c7df541df35f035b6f175006380c905d1f
- apps/web/src/lib/secure-notifications.ts | 3889 bytes | SHA-256 7d59bd59f2e0c0767e1245efe6023b93630f6ba853c289f83ec03a13f2278d3b
- apps/web/src/lib/smart-home-handlers.ts | 13521 bytes | SHA-256 d82d3abdb21632bcbd4a7e1a6bd483affd61c772cb75f7ee78f84b90b96125d7
- backend/services/vrbo_mailbridge/__init__.py | 600 bytes | SHA-256 91e6cdecabe8de1c23fc667b44a60b168fef21be2ff9d53c24de2f3b70a84c5b
- backend/services/vrbo_mailbridge/__main__.py | 56 bytes | SHA-256 5647fd3a4b96c8179f2320fde680329e0b02726ac4616355f6d07fe2e448b6ac
- backend/services/vrbo_mailbridge/evidence.py | 4842 bytes | SHA-256 81debf62fea2fd1ac5df3344c8a56d550dd3d7f5becae85c70f2e94baaa5d28a
- backend/services/vrbo_mailbridge/ical_evidence.py | 9685 bytes | SHA-256 430f888e0db5b91b6c47b2bdda981579d0b3e59c647115ea70f810ab7f2878c8
- backend/services/vrbo_mailbridge/imap_ingest.py | 6949 bytes | SHA-256 87c9324edb8fd70a29028594cd9f3064e574a53612a6108f88053be2f73bbf4f
- backend/services/vrbo_mailbridge/models.py | 3183 bytes | SHA-256 007152ec9f62f86b38e3776a19867f702e8e7d4b58b541acb0254eb2b51b147b
- backend/services/vrbo_mailbridge/parser.py | 16432 bytes | SHA-256 4c33ac4057eede37c6e53f2ac3238c81f6d688a2ef21d0c2e7fefd15fae39e62
- backend/services/vrbo_mailbridge/reconcile.py | 8885 bytes | SHA-256 c57f6055857d7d1c4da208c968431a000b2f7a2154d80e7455ffffec95961c6e
- backend/services/vrbo_mailbridge/repository.py | 16287 bytes | SHA-256 d4a913a77e4f42b9154b25d12e2430770cf8879089104865234a7c4745b47010
- backend/services/vrbo_mailbridge/run_once.py | 4621 bytes | SHA-256 61efe0ce35f729789389cbf42713f9333006bd4a1fe1ed706d2e89d0ff333468
- backend/services/vrbo_mailbridge/service.py | 2235 bytes | SHA-256 2c71fd4d0f9cb3dd608a155c431414f1a93dfe63ff31fe4395eccd58564a0917
- backend/tests/test_vrbo_ical_evidence.py | 1648 bytes | SHA-256 69d61b61ce2cbd9bbca09161a7ba98852b83abaa2d8aac184cf32f99e0d51e54
- backend/tests/test_vrbo_mail_parser.py | 3546 bytes | SHA-256 bfd28470bf8ee3225477a585e0d1d5f9d8bb2148b5eb42e36e2f6b8f9ba6fc80
- backend/tests/test_vrbo_reconcile.py | 6843 bytes | SHA-256 5b2d0649ba9387a7c6a9f6041586fe3a8f260d3fde6e64680462177506dd3dcf
- docs/VRBO_MAILBRIDGE_RUNBOOK.md | 4100 bytes | SHA-256 6d370494d3a82dc48f79508383a3d2e78dd410fe3dffce5967f8286eae63d402
- mailbridge_test_exit.txt | 4 bytes | SHA-256 9aca8dfce962538fb8131d73f84cada05e4dc79f5a0d3612c511b1150f3e33e2
- mailbridge_test_output.txt | 101 bytes | SHA-256 1022a07401c192132a0c7f5eeed4ba640aa7c18632a8ee43d211102a8668d0bc
- prisma/migrations/20260716190000_operations_foundation/migration.sql | 20299 bytes | SHA-256 e64fa9fcd1e3b2855ca231d90075350b5dca58e7681e9657d2393a0502012581
- prisma/migrations/migration_lock.toml | 119 bytes | SHA-256 4fed45ce5bace4de7cfebd99562068f2a920c371439c9b85b8f5e510751787d6
- scripts/run-vrbo-mailbridge.ps1 | 2982 bytes | SHA-256 3cf49c65ec8f5221307769156b9fc772384cae2efd3a19c2f3e84498df2f8ada
- tools/.edge-vrbo-profile/Default/AdPlatform/auto_show_data.db/000003.log | 33 bytes | SHA-256 68c7ad234755b9edb06832a084d092660970c89a7305e0c47d327b6ac50dd898
- tools/.edge-vrbo-profile/Default/Asset Store/assets.db/000004.log | 149901 bytes | SHA-256 5e3290ed97caeda53de57d4bfabbc88467671f607d1c113b74c03da1d9814879
- tools/.edge-vrbo-profile/Default/EdgeCoupons/coupons_data.db/000019.log | 3771 bytes | SHA-256 a1627435427a7acdd65c0675a0d8cbd1b2a33d95d21c45574ebbd77d03599082
- tools/.edge-vrbo-profile/Default/EdgePushStorageWithConnectTokenAndKey/000003.log | 3108 bytes | SHA-256 41d496a3dee1c8cf10c8a051fb2c1a757403cd6dc7f7921ff6c0994d66f41e28
- tools/.edge-vrbo-profile/Default/EntityExtraction/EntityExtractionAssetStore.db/000003.log | 152025 bytes | SHA-256 2b38cf65861c9bc378e591ab9de5b46ea9f9fcff150c26d57932e1088013a1f4
- tools/.edge-vrbo-profile/Default/Extension Rules/000003.log | 2736 bytes | SHA-256 a3fbcd5c82e73ae54e9e2d17e26ac6a4ed7024a4c742a9239298f1b3def22a14
- tools/.edge-vrbo-profile/Default/Extension Scripts/000003.log | 62271 bytes | SHA-256 37cf3c28c93c25488fa41907215d2377a60cae9b3213a0932bf11c051963b9ee
- tools/.edge-vrbo-profile/Default/Extension State/000003.log | 101050 bytes | SHA-256 d7c5c1870e64180474269a4424519e929210a8a0dc4bf0a2ad21506aa78372ce
- tools/.edge-vrbo-profile/Default/favorites_diagnostic.log | 24123 bytes | SHA-256 762e98cff7837db72f96bc20191d2a96043e2b6b241e73651e47043f1f6bafaf
- tools/.edge-vrbo-profile/Default/IndexedDB/chrome-extension_becfinhbfclcgokjlobojlnldbfillpf_0.indexeddb.leveldb/000003.log | 4794 bytes | SHA-256 f159db859fda95ba67213d88cf6aa90b841d31e722e6f3580b70273075135d12
- tools/.edge-vrbo-profile/Default/IndexedDB/chrome-extension_ejbalbakoplchlghecdalmeeeajnimhm_0.indexeddb.leveldb/000003.log | 4160 bytes | SHA-256 521dcf4bfb223ed130d4a2796f0c60899d47448a9c14f819c2c736660117b2bf
- tools/.edge-vrbo-profile/Default/IndexedDB/https_claude.ai_0.indexeddb.leveldb/000003.log | 8868 bytes | SHA-256 4b2c607a5e92b7d88e4ee3939234ecaf4cb7fa4c79c706ba1aa34725a83f5b1a
- tools/.edge-vrbo-profile/Default/IndexedDB/https_www.vrbo.com_0.indexeddb.leveldb/000003.log | 4846 bytes | SHA-256 55fb3e6bdf3e9237a22e87c1b59d97d2ebb625d922fe967fc126b6990cc3e742
- tools/.edge-vrbo-profile/Default/Local Extension Settings/amnbcmdbanbkjhnfoeceemmmdiepnbpp/000171.log | 1090254 bytes | SHA-256 735638fb935ad560aa79ee5a3477c61943173dd8993a059d9ba1a751cf8434be
- tools/.edge-vrbo-profile/Default/Local Extension Settings/becfinhbfclcgokjlobojlnldbfillpf/000003.log | 417731 bytes | SHA-256 18b9eb1de79938b73aa95bcccd7902035854abd79866b554b157ff433908945f
- tools/.edge-vrbo-profile/Default/Local Extension Settings/ejbalbakoplchlghecdalmeeeajnimhm/000015.log | 3314582 bytes | SHA-256 736874d31598a6ec27b976e19e5c0289a98da7390e28d2a22fb99c5977ee948c
- tools/.edge-vrbo-profile/Default/Local Extension Settings/fcoeoabgfenejglbffodgkkbkcdhcgfn/000003.log | 227 bytes | SHA-256 a724854e5a687c7620fd203fa5bf826cceb3270e3116930f1125bac189334d03
- tools/.edge-vrbo-profile/Default/Local Extension Settings/hnfanknocfeofbddgcijnmhnfnkdnaad/000007.log | 46031 bytes | SHA-256 b4655c74eb3cb1c56fe4722ca3e9081d8da4d007fa9e341aa9b294929ee03fac
- tools/.edge-vrbo-profile/Default/Local Extension Settings/jdiccldimpdaibmpdkjnbmckianbfold/000003.log | 0 bytes | SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- tools/.edge-vrbo-profile/Default/Local Extension Settings/mfbcdcnpokpoajjciilocoachedjkima/000003.log | 0 bytes | SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- tools/.edge-vrbo-profile/Default/Local Storage/leveldb/000010.log | 42962 bytes | SHA-256 25479de88d838e9c76b390e5a6a617296bdb410450857d1c90eb6d5c0e7e5e96
- tools/.edge-vrbo-profile/Default/Platform Notifications/000003.log | 0 bytes | SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- tools/.edge-vrbo-profile/Default/Service Worker/Database/000003.log | 47615 bytes | SHA-256 b66b3e15f7182337f48c9491fae51da00534c23287b10b62a6b807ec280cb26d
- tools/.edge-vrbo-profile/Default/Session Storage/000003.log | 39139 bytes | SHA-256 11025d960579cc2965b51927c9b23edd72be74db95ce9eb3e00a6ad2ac267e91
- tools/.edge-vrbo-profile/Default/shared_proto_db/000003.log | 15780 bytes | SHA-256 fffbc7119fccc9615b8dcfda623b14f6809999787522a34c1fce151909388e13
- tools/.edge-vrbo-profile/Default/shared_proto_db/metadata/000003.log | 1196 bytes | SHA-256 8ce4d571754b88a35684cb72b5d73b02d4d32c59cc5fad3bc587867cb0beb3de
- tools/.edge-vrbo-profile/Default/Site Characteristics Database/000003.log | 40 bytes | SHA-256 f096bc366a931fba656bdcd77b24af15a5f29fc53281a727c79f82c608ecfab8
- tools/.edge-vrbo-profile/Default/Storage/ext/ihmafllikibpmigkcoadcmckbfhibefp/def/Local Storage/leveldb/000003.log | 49 bytes | SHA-256 af47b5d07d2f1aa55711e00774a429289267a82e604602df8fdd2c5047626159
- tools/.edge-vrbo-profile/Default/Storage/ext/ihmafllikibpmigkcoadcmckbfhibefp/def/Session Storage/000003.log | 49 bytes | SHA-256 ffd700cf04be6fe8d51e2ffb8a2e37bc3fa95a6679a4102fa35e8494c2350eae
- tools/.edge-vrbo-profile/Default/Sync Data/LevelDB/000080.log | 111786 bytes | SHA-256 dc03f82180b43a7b23893f9e69eecf23275f88b8f90f741bf53c16aeb9716764
- tools/.edge-vrbo-profile/Default/Sync Data/Logs/cv_debug.log | 75941 bytes | SHA-256 d4a6d16e2805c57cffe37b7f31476f42198ba532c8f2488b60244e6f673f227f
- tools/.edge-vrbo-profile/Default/Sync Data/Logs/sync_diagnostic.log | 56413 bytes | SHA-256 1c89164a6f27e1bb87e2b6d7156dcf97b87f5ef76425854e31a37ab5967b7f96
- tools/.edge-vrbo-profile/Default/Sync Extension Settings/amnbcmdbanbkjhnfoeceemmmdiepnbpp/000003.log | 168 bytes | SHA-256 676360e0dfad9749285e1e65cc4bc6fdf66bc5da2e3bcfe60fb80dc462e53ed6
- tools/.edge-vrbo-profile/Default/Sync Extension Settings/becfinhbfclcgokjlobojlnldbfillpf/000003.log | 0 bytes | SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- tools/.edge-vrbo-profile/Default/Sync Extension Settings/fjnbnpbmkenffdnngjfgmeleoegfcffe/000003.log | 1587 bytes | SHA-256 54cb8bcae30f50e684349429742976a2a81d437bfc67edce5f4ceb973b1f19d6
- tools/.edge-vrbo-profile/Default/Sync Extension Settings/mfbcdcnpokpoajjciilocoachedjkima/000003.log | 0 bytes | SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
- tools/.vrbo-chrome-profile/Default/Extension Rules/000003.log | 38 bytes | SHA-256 1c43a1bda1e458863c46dfae7fb43bfb3e27802169f37320399b1dd799a819ac
- tools/.vrbo-chrome-profile/Default/Extension Scripts/000003.log | 38 bytes | SHA-256 1c43a1bda1e458863c46dfae7fb43bfb3e27802169f37320399b1dd799a819ac
- tools/.vrbo-chrome-profile/Default/Extension State/000003.log | 114 bytes | SHA-256 e2610960c3757d1757f206c7b84378efa22d86dcf161a98096a5f0e56e1a367e
- tools/.vrbo-chrome-profile/Default/GCM Store/000003.log | 1189 bytes | SHA-256 4b0a9c1ea3e36781fbaba17ee0c2f45ba6f2802f9e4881d23815a27ef34e2271
- tools/.vrbo-chrome-profile/Default/Local Storage/leveldb/000006.log | 12569 bytes | SHA-256 f6782a5902499164a45e05d866e6fc178e35a78ccea1c64788b08dcd0ef93a43
- tools/.vrbo-chrome-profile/Default/Session Storage/000003.log | 13376 bytes | SHA-256 ffcbb4fddb06b06d24ae16256fc9c8f4ea8df0fe702a3c066570edae46fcb7f2
- tools/.vrbo-chrome-profile/Default/shared_proto_db/000003.log | 12175 bytes | SHA-256 fe82a0c31bd0123207a33de7495e4d6c729f04200747cc04511e789c82f8dc6f
- tools/.vrbo-chrome-profile/Default/shared_proto_db/metadata/000003.log | 992 bytes | SHA-256 2ea65ba6e885e2d52335c02c82e58120f2ae7d8d81d5c9c4f66098526af87f80
- tools/.vrbo-chrome-profile/Default/Site Characteristics Database/000003.log | 235 bytes | SHA-256 658455c0a996cd30c532db314430f37e28a495e86df22b2dc1e324c87f01fae3
- tools/.vrbo-chrome-profile/Default/Sync Data/LevelDB/000003.log | 118 bytes | SHA-256 b201e50dd759e0c41786332abd0c141372955e9489cf632cc09100d1f46b3ac7
- tools/p0_compare_sources.ps1 | 8426 bytes | SHA-256 46260a769108ecbac517f6ac1f586b0b2022e62b1cab9b638408a777f701aff9
- tools/p0_compare_sources_detached.ps1 | 1318 bytes | SHA-256 34aa4477cb28539e6eadf1b09f1eede487f70d670c82bdf28a42fe9a3509a9e4
- tools/p0_expand_static_assertions.py | 2087 bytes | SHA-256 9c09a8444c0743546fd83cb8f0236745515c1c946fdbec4a2e3884f7cadb7ce0
- tools/p0_mark_dynamic_routes.py | 1513 bytes | SHA-256 ac67b0d4198f63f0d4d2c80e612600751c25275225e19e7f80b6429572f6a901
- tools/p0_patch_ci_health.py | 1254 bytes | SHA-256 03ceff5ec41eb78dbe82e8d32607b221490c2631d0304c62271896503f5c7b90
- tools/p0_patch_compare_traversal.py | 3653 bytes | SHA-256 a5476e6672425d63e71b109065f5823f67ff27a62eb25c47b5fc294a98d4a93c
- tools/p0_patch_mobile_auth.py | 2786 bytes | SHA-256 79259d80ffb3fa248b4f264a5d080d39b41da3f7a12181a1ba4b71c3a5b452e3
- tools/p0_patch_mobile_compat_entries.py | 1326 bytes | SHA-256 e2b2e050ba7e856e2e257c7104ce30f1176dee18e05ff8d67ea92b7c6cab2fe8
- tools/p0_patch_mobile_database_binds.py | 7381 bytes | SHA-256 1183c758305aa1578ca86b432cf2259960d130ad4ee224957f5965450cd8d18c
- tools/p0_patch_mobile_notifications_api.py | 796 bytes | SHA-256 52dab525f9d5d63f188fe546e609b07b6ee88c5efbdf203981d9aab77401dc71
- tools/p0_patch_mobile_type_errors.py | 7880 bytes | SHA-256 f6e25508f625a59beb612e89b91434c3ce08ee5f11e92bd2801cea1da84a816b
- tools/p0_patch_photos_firebase.py | 4950 bytes | SHA-256 31174af1f5da6cf23049165e2ed6ea8cb239f7a70af1100acdb8ec294e3351d7
- tools/p0_patch_profile_arrow.py | 484 bytes | SHA-256 455b2eb8fe3337427ecfae3a0e0f251d32d5ab7d669fbaf776244a93307cb303
- tools/p0_patch_shared_package.py | 1264 bytes | SHA-256 4e6314615a866c3b4e2aaedb1a549e234d5d79b7bbd071dbc6b82b45b32a9c3e
- tools/p0_patch_shared_sync.py | 838 bytes | SHA-256 0e65328de530e322f433fd68ac457e707d912a6eed3a363081ba634b46c56b67
- tools/p0_patch_verification_matrix.py | 1801 bytes | SHA-256 7dbce2762724752cbbe63d7cf3475597171952f8daf858238a859e7608741bf8
- tools/p0_replace_legacy_firebase_refs.py | 1097 bytes | SHA-256 c0b49002702eebbbcff37e3c036e9d26ea98ba6e37f6a1c212d104add6923a29
- tools/p0_run_validation_detached.ps1 | 999 bytes | SHA-256 9a6157aea46df8ac49328d4352b8d29d4771fdbc66d265fa721492691823861f
- tools/p0_static_assertions.mjs | 9979 bytes | SHA-256 43f97cb087c0b49111a9db9b4af8d38a2fb7cf5c1c89137f0cc1acdff9ad8284
- tools/p0_verify_environment.ps1 | 15842 bytes | SHA-256 7ca4a8984b46ef5e6181f417048d9191a7e8903b224d570a2c1bbeef1218299c
- tools/p0_web_build_detached.ps1 | 1883 bytes | SHA-256 56e0ff9cd9c6d772680fd15400be9e9c18342e309a5792489342558803551354
- tools/p0_workspace_tests_detached.ps1 | 1198 bytes | SHA-256 3a3cb819f2a5ca41b046ecd88129094fe09615452c70c57c871bf95ff6cf71db
- tools/vrbo-scraper-output.log | 0 bytes | SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

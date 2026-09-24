# 路书本地 Demo

这是一个静态 HTML 应用，iPhone Safari 优先。受邀账号的路书保存在 Supabase；图片使用私有云存储。

## 需求与协作

- [需求记录](REQUIREMENTS.md)：后续新增需求、变更及完成状态统一记录在此。
- [需求记录技能](../skills/roadbook-requirements/SKILL.md)：规定接收需求时同步更新 Markdown。
- [项目协作入口](../AGENTS.md)：后续处理本项目时先读取上述技能和需求记录。

## 本地运行

在本目录执行：

\`\`\`bash
python3 -m http.server 4173
\`\`\`

随后访问 [http://localhost:4173](http://localhost:4173)。

## 已实现

- 空状态新建、多份路书卡片列表
- 起止日期与按天编辑
- 交通、游玩、吃饭三类行程表单
- 旧版浏览器数据的云端迁移
- 查看页日期页签、可展开日历、当前时间段高亮
- 极简 / 复杂查看模式切换；复杂模式支持单行程大卡片与卡片横向切换
- 行程图片上传私有云存储、预览、移除，以及复杂模式的多图滑动
- 交通行程可设置 1 个主方案与最多 2 个备选方案，并可在查看卡片中切换
- 复杂模式按手机可见高度自动分配图片与内容区域，保留安全区；超长内容可在卡片内滚动
- JSON 数据导出
- 极简/复杂模式均支持将单个行程移动或复制到当前路书的指定日期，按开始时间插入
- Supabase 邮箱登录及账号隔离的云端同步（完成项目配置后启用）

## Supabase 云端同步配置

1. 在 Supabase 创建项目，然后在 SQL Editor 执行 [`supabase-schema.sql`](supabase-schema.sql)。已有项目也要重新执行该文件，新增 `roadbook-images` 私有图片桶和按账号隔离的访问策略。`roadbook_access` 是所有者的获批邮箱清单。
2. 在 Supabase Auth → Users 邀请你自己的邮箱账号，并在 SQL Editor 将你的邮箱加入获批清单：`insert into public.roadbook_access (email) values (lower('你的邮箱'));`。之后每批准一人，先在 Auth → Users 邀请该邮箱，再将它加入清单；撤销时从清单删除该邮箱。网站没有公开注册按钮，未批准的账号即使登录也无法进入或读取路书。
3. 在 Project Settings → API 找到 Project URL 和 anon/publishable key，填入 [`supabase-config.js`](supabase-config.js)。这些浏览器端公开配置依赖数据库 RLS 保护；绝不要填入 `service_role` 密钥。
4. 在 Authentication → URL Configuration 将 Site URL 设为 `https://grandezzz.github.io/RoadBook/`，并将该站点 URL 加入允许的 Redirect URLs。邀请邮件会返回此站点；如果它指向未部署的地址，点击链接可能打开空白或错误页面。
5. 在 Supabase Auth → Users 邀请用户，用户点击邀请邮件并设置密码后，再使用获批邮箱和密码登录。同一账号可在不同设备查看和同步；Supabase Auth 会话设置需允许多设备会话。应用退出登录只结束当前设备会话，不影响其他设备。应用不会开放注册。首次登录时，已有本地路书会上传。若云端已有数据，则以云端为准。初次邀请和密码重设邮件仍受 Supabase 邮件服务发送频率/额度限制。

新图片直接上传到 Supabase Storage，路书记录只保存图片路径。旧版嵌在路书里的图片会在获批账号登录时迁移；只有全部上传并成功保存云端记录后，才会清除与云端原始数据一致的旧浏览器副本。若本机还有与云端不同的旧数据，会保留以免丢失并显示提示；迁移失败也会保留原图。网页按需获取有效期为一小时的私有图片链接；浏览器仍可能有正常的临时网络缓存。图片桶单张上限为 10 MB，支持 JPEG、PNG、WebP、GIF、HEIC 和 HEIF。JSON 导出只包含云端路径，不包含图片文件；如需完整备份，请同时备份 Supabase Storage。

注意：当前部署目标 GitHub Pages 是静态公开托管，登录门禁保护应用里的路书内容及 Supabase 数据；HTML/JavaScript 等网站文件本身仍可被公开访问和下载。若要求整个站点文件也只能由获批访客访问，需要迁移到支持服务器端访问控制的托管方案。

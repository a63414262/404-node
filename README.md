🚀 404node

“Hidden in plain sight.” 基于 fscarmen2/Argo-Xray-JS-PaaS  https://github.com/fscarmen2/Argo-Xray-JS-PaaS 架构深度重构的隐匿型全协议代理面板。

本项目将一个强大的 Xray + Cloudflared 节点完美伪装成了一个普通的 404 错误页面。只有掌握“密钥路径”的人，才能唤醒沉睡在底层的多路复用网络面板与实时监控系统。
✨ 核心特性 (Core Features)
1. 🛡️ 绝对隐蔽的 404 伪装 (Cyberpunk 404 Disguise)

    防探测主页：直接访问根目录 (/)，只会展示一个带有“打字机特效”的中英双语 Hacker 风格 404 科普页面。

    无死角隐藏：首页不包含任何跳转按钮或超链接，真正的功能入口被完全从前端剥离，有效防御网络爬虫与主动探测。

2. 🚦 L7 全协议多路复用 (L7 Multiplexing)

    突破限制：通过 Node.js 层面的自定义 TCP 流量分发器 (Multiplexer)，打破了 Argo 隧道单端口转发的限制。

    三网并发：根据 HTTP 请求路径的智能嗅探，在同一个 Argo 域名下完美实现 VLESS + Trojan + VMess 三大核心协议的共存与满速运行。

3. 🎛️ 极简节点提取面板 (Secret Node Dashboard)

    隐藏路径 /node：访问此专属路径，即可解锁后台面板。

    一键生成：系统会自动适配当前分配的临时域名或固定的 Argo 域名，直接生成排版整洁的节点链接，方便一键导入各大主流代理客户端。

4. 📜 内存级实时监控 (Real-time Memory Logs)

    隐藏路径 /log：无需登录 PaaS 平台的云端控制台，直接通过专属路径查看底层运行状态。

    精准排错：动态截获并分类展示核心启动(SYSTEM)、Xray 进程(XRAY-INFO)、Argo 隧道(ARGO-LOG)的最新 200 条日志，让调试变得轻而易举。

🛠️ 部署指南 (Deployment)

支持一键部署到主流 Node.js 运行环境（如 Render, Zeabur, HuggingFace 等）。

环境变量设置：
变量名	必填	默认值	说明
UUID	否	de04...	你的专属 UUID，同时用作 Trojan 的密码
ARGO_AUTH	否	空	Cloudflare Argo 隧道的 Token 或 JSON 凭证
PORT	否	3000	Node.js 对外监听的主端口 (PaaS 平台通常会自动分配)
🧭 密钥路径 (How to Access)

部署成功后，请使用你的域名进行访问。请记住你的专属路径，不要泄露：

    🎭 欣赏伪装：直接访问 https://你的域名/ （展示 404 页面）。

    🔑 提取节点：访问 https://你的域名/node 

    🩺 后台排错：访问 https://你的域名/log （查看实时运行日志）。

🙏 鸣谢 (Credits)

    核心底层架构基于 @fscarmen2  https://github.com/fscarmen2/Argo-Xray-JS-PaaS  的开源项目二次开发。

    感谢 XTLS 项目提供强大的 Xray-core。

    感谢 Cloudflare 提供的 Argo Tunnel 隧道技术。

    ⚠️ 免责声明：本项目仅供编程学习与网络安全测试使用，请严格遵守您所在地区的法律法规，切勿用于任何非法用途。

// 1. 网页服务 (运行在内部端口 3001)
const server = http.createServer((req, res) => {
    // 【日志页面】
    if (req.url === '/log') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`=== 系统实时日志 (最新200条) ===\n\n${logs.join('\n')}\n\n===========================\n提示: 刷新页面可获取最新日志。`);
        return;
    }

    // 【节点面板页面】 - 现在只有精确访问 /node 才会显示
    if (req.url === '/node') {
        const displayDomain = ARGO_AUTH !== "" ? "固定域名(请使用你绑定的CF域名)" : argoDomain;
        
        const vlessLink = `vless://${UUID}@${displayDomain}:443?encryption=none&security=tls&type=ws&host=${displayDomain}&path=%2Fvl#Argo_VLESS`;
        const trojanLink = `trojan://${UUID}@${displayDomain}:443?security=tls&type=ws&host=${displayDomain}&path=%2Ftr#Argo_Trojan`;
        
        const vmessObj = {
            v: "2", ps: "Argo_VMess", add: displayDomain, port: "443", id: UUID,
            aid: "0", net: "ws", type: "none", host: displayDomain, path: "/vm", tls: "tls"
        };
        const vmessLink = `vmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`;
        
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        if (argoDomain.includes("trycloudflare.com") || ARGO_AUTH !== "") {
            res.end(`--- Argo Xray (全协议多路复用版) ---\n状态: 运行正常\n域名: ${displayDomain}\nUUID: ${UUID}\n\n节点链接:\n==================================================\n🟢 【VLESS】\n${vlessLink}\n\n🟣 【Trojan】\n${trojanLink}\n\n🔵 【VMess】\n${vmessLink}\n==================================================\n\n👉 想看运行日志？请访问: /log`);
        } else {
            res.end(`隧道启动中...\n状态: ${argoDomain}\n\n👉 迟迟不显示？请访问 /log 查看后台报错。`);
        }
    } 
    // 【赛博朋克 404 页面】 - 现在直接访问首页 (/) 或其他错误路径都会来到这里
    else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        const html404 = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - 迷失在赛博空间</title>
            <style>
                body { font-family: 'Courier New', Courier, monospace; background-color: #0d0d0d; color: #00ff00; padding: 20px; line-height: 1.6; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                .container { max-width: 800px; background: #1a1a1a; padding: 40px; border-radius: 8px; box-shadow: 0 0 30px rgba(0, 255, 0, 0.1); border: 1px solid #333; }
                h1 { font-size: 4em; color: #ff3333; text-shadow: 2px 2px #cc0000; margin-top: 0; margin-bottom: 10px; }
                h2 { color: #00ccff; border-bottom: 1px dashed #00ccff; padding-bottom: 5px; margin-top: 30px; }
                p { font-size: 1.1em; color: #cccccc; }
                .highlight { color: #ffaa00; font-weight: bold; }
                .nav { margin-top: 40px; text-align: center; display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
                a { color: #00ff00; text-decoration: none; border: 1px solid #00ff00; padding: 10px 20px; border-radius: 4px; transition: all 0.3s; font-weight: bold; background: rgba(0,255,0,0.05); }
                a:hover { background: #00ff00; color: #0d0d0d; box-shadow: 0 0 15px #00ff00; }
                .cursor { display: inline-block; width: 10px; height: 1.2em; background-color: #00ff00; vertical-align: middle; animation: blink 1s step-end infinite; }
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404 Not Found</h1>
                <p><strong><span id="typewriter"></span><span class="cursor"></span></strong></p>
                
                <h2>🌐 404 的前世今生</h2>
                <p><span class="highlight">【都市传说】：</span>据说，万维网之父 Tim Berners-Lee 当年在瑞士的 CERN（欧洲核子研究中心）工作时，中央数据库就设在 <strong>404 房间</strong>。由于早期网络极不稳定，大家经常找不到文件，便会互相抱怨：“又报 404 房间的错了”。</p>
                <p><span class="highlight">【技术真相】：</span>其实 CERN 根本没有 404 房间（他们的办公室编号是从 410 开始的）。404 只是 HTTP 状态码的冰冷逻辑：<strong>4</strong> 代表客户端错误（例如路径拼写错误），<strong>04</strong> 代表在这些分类中，"未找到 (Not Found)" 被排在了第 4 号。</p>
                
                <h2>🎨 404 亚文化</h2>
                <p>从最初令人沮丧的技术报错，404 页面现已演变为互联网特有的浪漫。有些被做成恐龙跑酷小游戏，有些用来挂载公益寻人启事，而在这里，它成了你探索这台代理服务器底层的证明。</p>
                
                <div class="nav">
                    <a href="/node">👉 返回节点中心</a>
                    <a href="/log">📜 查看运行日志</a>
                </div>
            </div>
            <script>
                const text = "[系统提示]：坐标丢失，你似乎游荡到了这台服务器的未分配象限。";
                let i = 0;
                function type() {
                    if (i < text.length) {
                        document.getElementById("typewriter").innerHTML += text.charAt(i);
                        i++;
                        setTimeout(type, 60);
                    }
                }
                window.onload = type;
            </script>
        </body>
        </html>
        `;
        res.end(html404);
    }
});

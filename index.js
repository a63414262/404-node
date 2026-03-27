const http = require('http');
const { spawn, exec } = require('child_process');
const fs = require('fs');

const port = process.env.PORT || 3000;
const UUID = process.env.UUID || "de04accx-1af7-4b13-90ce-64197351d4c6";
const ARGO_AUTH = process.env.ARGO_AUTH || ""; 
const XRAY_PORT = 8080;
let argoDomain = "正在获取中，请在1分钟后刷新页面...";

// 1. 创建原生 HTTP Web 服务 (替代 Express)
const server = http.createServer((req, res) => {
    if (req.url === '/node') {
        // 如果是临时隧道，或者填写了固定 ARGO_AUTH
        if (argoDomain.includes("trycloudflare.com") || ARGO_AUTH !== "") {
            const displayDomain = ARGO_AUTH !== "" ? "固定域名(请使用你绑定的CF域名)" : argoDomain;
            const vlessLink = `vless://${UUID}@${displayDomain}:443?encryption=none&security=tls&type=ws&host=${displayDomain}&path=%2Fvl#Argo_Node`;
            
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`--- Argo Xray 节点信息 ---\n状态: 已就绪\n域名: ${displayDomain}\nUUID: ${UUID}\n路径: /vl\n端口: 443 (TLS)\n\nVLESS 订阅链接:\n${vlessLink}`);
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`隧道正在启动中...\n当前状态: ${argoDomain}\n请稍后刷新页面获取链接。`);
        }
    } else {
        // 伪装 404
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html><head><title>404 Not Found</title></head>
            <body style="font-family:sans-serif;text-align:center;padding-top:100px;background:#f4f4f4;">
                <h1 style="font-size:50px;">404</h1><p>The requested URL was not found on this server.</p><hr style="width:50%">
                <address>Apache/2.4.41 Server at ${req.headers.host || 'localhost'} Port ${port}</address>
            </body></html>
        `);
    }
});

server.listen(port, () => {
    console.log(`Web server started on port ${port}`);
    startAll();
});

// 2. 核心启动逻辑
function startAll() {
    // 写入 Xray 配置文件
    const config = {
        inbounds: [{
            port: XRAY_PORT, protocol: "vless",
            settings: { clients: [{ id: UUID }], decryption: "none" },
            streamSettings: { network: "ws", wsSettings: { path: "/vl" } }
        }],
        outbounds: [{ protocol: "freedom" }]
    };
    fs.writeFileSync('config.json', JSON.stringify(config));

    // 下载核心文件 (Xray + Cloudflared)
    const setup = `
        curl -L -s https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o xray.zip && unzip -o xray.zip && chmod +x xray
        curl -L -s https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cf && chmod +x cf
    `;

    console.log("正在下载依赖文件...");
    exec(setup, (err) => {
        if (err) {
            console.error("文件下载失败:", err);
            return;
        }
        console.log("下载完成，正在启动服务...");

        // 启动 Xray
        spawn('./xray', ['-c', 'config.json'], { stdio: 'ignore', detached: true }).unref();

        // 启动 Argo 隧道
        let args = ['tunnel', '--url', `http://localhost:${XRAY_PORT}`, '--no-autoupdate'];
        
        if (ARGO_AUTH) {
            if (ARGO_AUTH.includes('{')) {
                fs.writeFileSync('tunnel.json', ARGO_AUTH);
                args = ['tunnel', '--no-autoupdate', 'run', '--cred-file', 'tunnel.json'];
            } else {
                args = ['tunnel', '--no-autoupdate', 'run', '--token', ARGO_AUTH];
            }
        }

        const cf = spawn('./cf', args);
        
        // 监听隧道日志获取临时域名
        cf.stderr.on('data', (data) => {
            const log = data.toString();
            if (log.includes('.trycloudflare.com')) {
                const match = log.match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/i);
                if (match) {
                    argoDomain = match[1];
                    console.log(`隧道已就绪: ${argoDomain}`);
                }
            }
        });
    });
}

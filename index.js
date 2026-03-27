const http = require('http');
const net = require('net'); // 【新增】用于底层 TCP 流量分发
const { spawn, exec } = require('child_process');
const fs = require('fs');

const webPort = process.env.PORT || 3000; // 对外暴露的主端口
const WEB_UI_PORT = 3001; // 内部 Web 界面端口
const UUID = process.env.UUID || "de04acca-1af7-4b13-90ce-64197351d4c6";
const ARGO_AUTH = process.env.ARGO_AUTH || ""; 
let argoDomain = "正在连接 Cloudflare 隧道...";

// --- 内存日志系统 ---
const logs = [];
function addLog(module, msg) {
    const time = new Date().toISOString().split('T')[1].slice(0, 8);
    const line = `[${time}] [${module}] ${msg.trim()}`;
    console.log(line);
    logs.push(line);
    if (logs.length > 200) logs.shift();
}

// 1. 网页服务 (运行在内部端口 3001)
const server = http.createServer((req, res) => {
    if (req.url === '/log') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`=== 系统实时日志 (最新200条) ===\n\n${logs.join('\n')}\n\n===========================\n提示: 刷新页面可获取最新日志。`);
        return;
    }

    if (req.url === '/node' || req.url === '/') {
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
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="text-align:center;padding-top:100px;"><h1>404 Not Found</h1></body></html>`);
    }
});

server.listen(WEB_UI_PORT, () => {
    addLog('SYSTEM', `Web UI 已启动在内部端口: ${WEB_UI_PORT}`);
    startMultiplexer(); // 启动流量分发器
});

// 2. 【核心】L7 流量分发器 (运行在主端口 3000)
function startMultiplexer() {
    const muxServer = net.createServer((socket) => {
        socket.once('data', (data) => {
            const reqStr = data.toString('utf8');
            let targetPort = WEB_UI_PORT; // 默认将流量给 Web 界面

            // 根据 HTTP 请求路径智能分发流量
            if (reqStr.includes('GET /vl') || reqStr.includes('GET /vl/')) {
                targetPort = 10001; // 转发给 VLESS
            } else if (reqStr.includes('GET /tr') || reqStr.includes('GET /tr/')) {
                targetPort = 10002; // 转发给 Trojan
            } else if (reqStr.includes('GET /vm') || reqStr.includes('GET /vm/')) {
                targetPort = 10003; // 转发给 VMess
            }

            // 建立到目标端口的连接并透传数据
            const proxy = net.createConnection(targetPort, '127.0.0.1', () => {
                proxy.write(data); // 把截获的第一包数据发过去
                socket.pipe(proxy);
                proxy.pipe(socket);
            });

            proxy.on('error', () => socket.end());
            socket.on('error', () => proxy.end());
        });
    });

    muxServer.listen(webPort, () => {
        addLog('SYSTEM', `流量多路复用器 (Multiplexer) 启动在端口: ${webPort}`);
        startCore(); // 启动 Xray 和 Argo
    });
}

// 3. 核心进程启动逻辑
function startCore() {
    addLog('SYSTEM', '正在生成多协议配置文件...');
    
    // 【修改】Xray 配置，开启三个完全独立的入站端口
    const config = {
        log: { loglevel: "debug" },
        inbounds: [
            {
                port: 10001, listen: "127.0.0.1", protocol: "vless",
                settings: { clients: [{ id: UUID }], decryption: "none" },
                streamSettings: { network: "ws", wsSettings: { path: "/vl" } }
            },
            {
                port: 10002, listen: "127.0.0.1", protocol: "trojan",
                settings: { clients: [{ password: UUID }] },
                streamSettings: { network: "ws", wsSettings: { path: "/tr" } }
            },
            {
                port: 10003, listen: "127.0.0.1", protocol: "vmess",
                settings: { clients: [{ id: UUID, alterId: 0 }] },
                streamSettings: { network: "ws", wsSettings: { path: "/vm" } }
            }
        ],
        outbounds: [{ protocol: "freedom" }]
    };
    fs.writeFileSync('config.json', JSON.stringify(config));

    addLog('SYSTEM', '正在下载二进制核心...');
    const setup = `curl -L -s https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o xray.zip && unzip -o xray.zip && chmod +x xray && curl -L -s https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cf && chmod +x cf`;

    exec(setup, (err) => {
        if (err) {
            addLog('ERROR', `下载核心失败: ${err.message}`);
            return;
        }
        addLog('SYSTEM', '下载完成，准备启动核心进程...');
        
        const xrayProcess = spawn('./xray', ['-c', 'config.json']);
        xrayProcess.stdout.on('data', (data) => addLog('XRAY-INFO', data.toString()));
        xrayProcess.stderr.on('data', (data) => addLog('XRAY-WARN', data.toString()));
        xrayProcess.on('close', (code) => addLog('XRAY-EXIT', `进程异常退出，退出码: ${code}`));

        // 【修改】让 Argo 隧道直接连接到我们的 Node.js 流量分发器
        let args = ['tunnel', '--url', `http://127.0.0.1:${webPort}`, '--no-autoupdate'];
        if (ARGO_AUTH) {
            if (ARGO_AUTH.includes('{')) {
                fs.writeFileSync('tunnel.json', ARGO_AUTH);
                args = ['tunnel', '--no-autoupdate', 'run', '--cred-file', 'tunnel.json'];
            } else {
                args = ['tunnel', '--no-autoupdate', 'run', '--token', ARGO_AUTH];
            }
        }

        const cfProcess = spawn('./cf', args);
        cfProcess.stdout.on('data', (data) => addLog('ARGO-INFO', data.toString()));
        cfProcess.stderr.on('data', (data) => {
            const log = data.toString();
            addLog('ARGO-LOG', log);
            
            if (log.includes('.trycloudflare.com')) {
                const match = log.match(/https:\/\/([a-z0-9-]+\.trycloudflare\.com)/i);
                if (match) {
                    argoDomain = match[1];
                    addLog('SYSTEM', `成功抓取到隧道域名: ${argoDomain}`);
                }
            }
        });
        cfProcess.on('close', (code) => addLog('ARGO-EXIT', `隧道进程退出，退出码: ${code}`));
    });
}

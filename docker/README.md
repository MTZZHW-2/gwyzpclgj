# Docker 部署笔记

用来记录如何用 Docker 在服务器上部署当前项目的步骤和注意事项。

环境：Ubuntu 22.04 LTS

## 目录

- [先决条件](#先决条件)
- [项目结构概览](#项目结构概览)
- [首次部署](#首次部署)
  - [步骤 1: 构建 Docker 镜像](#步骤-1-构建-docker-镜像)
  - [步骤 2: 启动基础服务](#步骤-2-启动基础服务)
  - [步骤 3: 申请 SSL 证书](#步骤-3-申请-ssl-证书)
  - [步骤 4: 启用全局 TLS 安全配置](#步骤-4-启用全局-tls-安全配置)
  - [步骤 5: 启用 HTTPS 站点](#步骤-5-启用-https-站点)
- [日常维护](#日常维护)
  - [启动和停止服务](#启动和停止服务)
  - [续订 SSL 证书](#续订-ssl-证书)
  - [更新应用](#更新应用)
- [Makefile 命令参考](#makefile-命令参考)

---

### 先决条件

系统更新（推荐）：

```bash
sudo apt update && sudo apt upgrade -y
```

- Docker Engine: [安装指南](https://docs.docker.com/engine/install/ubuntu/)

### 项目结构概览

- `docker/compose.yml`: Compose 配置，定义 `proxy`、`web`、`certbot`。
- `docker/proxy/volumes/config/`
  - `nginx.conf`: Nginx 主配置（http 级别）。
  - `default.conf`: 80 端口，处理 HTTP-01 质询和基础转发。
  - `ssl.conf.template`: 443 端口站点配置模板。
  - `ssl-params.conf.template`: TLS 参数模板（全局基线，Mozilla intermediate）。
- `docker/ssl/volumes/`: 证书与密钥材料（包括 `dhparam.pem`、Let's Encrypt 目录）。

### 首次部署

按下面步骤走一遍，保证 HTTPS 配好。

#### 步骤 1: 构建 Docker 镜像

先构建镜像：

```bash
make build-all
```

会构建 `web` 应用镜像。

#### 步骤 2: 启动基础服务

启动服务栈：

```bash
make up
```

该命令会准备必要的目录/文件，并以后台模式启动 Nginx 和 Web。此时仅能通过 HTTP 访问，便于 Certbot 完成域名验证。

#### 步骤 3: 申请 SSL 证书

启动后为域名申请 SSL 证书。

执行前，确保 `Makefile` 里 `cert-init` 任务的域名是正确的：

```makefile
cert-init:
  # ...
  #  -d gwyzpclgj.mtzzhw.com \
  # ...
```

改完后执行：

```bash
make cert-init
```

Certbot 使用 `webroot` 方式验证，证书会出现在 `docker/ssl/volumes/live/`。

#### 步骤 4: 启用全局 TLS 安全配置

准备全局 TLS 参数（Mozilla 推荐基线）：

```bash
make enable-ssl-params
```

会做两件事：

1. 从 Mozilla 下载标准化 `dhparam.pem`（提升密钥交换强度）。
2. 把 `ssl-params.conf.template` 复制为 `ssl-params.conf` 并生效。

#### 步骤 5: 启用 HTTPS 站点

开启 HTTPS 站点配置：

```bash
make enable-ssl
```

会把 `ssl.conf.template` 复制为 `ssl.conf` 并重载 Nginx。此后网站通过 HTTPS 提供服务。

### 日常维护

#### 启动和停止服务

- 启动：`make up`
- 停止：`make down`

#### 续订 SSL 证书

Let's Encrypt 证书有效期 90 天，建议用 cron 定时续订。

手动续订证书的命令是：

```bash
make cert-renew
```

该命令会检查并续订即将过期的证书。若要立刻让新证书生效，手动执行：`make enable-ssl`（触发 Nginx reload）。

#### 更新应用

代码有更新时，重新构建并启动即可：

```bash
make build-web
make up
```

Compose 会自动使用新镜像启动容器。

### Makefile 命令参考

- `build-all`: 构建所有必需的 Docker 镜像。
- `up`: 启动整个服务栈。
- `down`: 停止整个服务栈。
- `cert-init`: 首次申请 SSL 证书。
- `cert-renew`: 续订 SSL 证书。
- `enable-ssl-params`: 启用全局 TLS 安全配置。
- `enable-ssl`: 启用 HTTPS 站点配置。

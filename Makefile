DOCKER_REGISTRY=gwyzpclgj
WEB_IMAGE=$(DOCKER_REGISTRY)/web
VERSION=latest

# 构建所有必需的 Docker 镜像
.PHONY: build-web build-all
build-web:
	@echo "正在构建 web 镜像：$(WEB_IMAGE):$(VERSION)..."
	docker build -t $(WEB_IMAGE):$(VERSION) ./
	@echo "web 镜像构建成功：$(WEB_IMAGE):$(VERSION)"

build-all: build-web

# 管理服务
.PHONY: up down
up:
	@echo "正在启动服务栈..."
	mkdir -p docker/proxy/volumes/config docker/ssl/volumes
	touch docker/proxy/volumes/config/ssl.conf
	touch docker/proxy/volumes/config/ssl-params.conf
	touch docker/ssl/volumes/dhparam.pem
	docker compose -f docker/compose.yml up -d
	@echo "服务已启动"

down:
	@echo "正在停止服务栈..."
	docker compose -f docker/compose.yml down
	@echo "服务已停止"

# 启用 HTTPS 站点配置
.PHONY: enable-ssl
enable-ssl:
	@echo "正在启用 HTTPS 站点配置..."
	@echo "--> 步骤 1/2: 启用 HTTPS 站点配置文件..."
	cp docker/proxy/volumes/config/ssl.conf.template docker/proxy/volumes/config/ssl.conf
	@echo "--> 步骤 2/2: 测试并重载 Nginx 配置..."
	docker compose -f docker/compose.yml exec proxy nginx -t
	docker compose -f docker/compose.yml exec proxy nginx -s reload || true
	@echo "HTTPS 站点配置已成功启用。"

# 启用全局 TLS 安全配置
.PHONY: enable-ssl-params
enable-ssl-params:
	@echo "正在准备并启用全局 TLS 配置..."
	@echo "--> 步骤 1/3: 获取标准化的 DH 参数..."
	mkdir -p docker/ssl/volumes
	curl -sS https://ssl-config.mozilla.org/ffdhe2048.txt > docker/ssl/volumes/dhparam.pem
	@echo "--> 步骤 2/3: 启用 HTTP 级 TLS 基线配置文件..."
	cp docker/proxy/volumes/config/ssl-params.conf.template docker/proxy/volumes/config/ssl-params.conf
	@echo "--> 步骤 3/3: 测试并重载 Nginx 配置..."
	docker compose -f docker/compose.yml exec proxy nginx -t
	docker compose -f docker/compose.yml exec proxy nginx -s reload || true
	@echo "全局 TLS 配置已成功启用。"

# 证书管理
.PHONY: cert-init cert-renew
cert-init:
	@echo "申请证书..."
	docker compose -f docker/compose.yml up -d proxy
	docker compose -f docker/compose.yml run --rm --entrypoint certbot certbot \
	  certonly --webroot -w /var/www/certbot \
	  -d gwyzpclgj.mtzzhw.com \
	  --email root@mtzzhw.com --agree-tos --no-eff-email --rsa-key-size 4096 --force-renewal
	@echo "证书申请完成。如需立即生效，请手动执行：make enable-ssl-params 和 make enable-ssl"

cert-renew:
	@echo "续期证书..."
	docker compose -f docker/compose.yml run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot --quiet
	@echo "续期完成。如需立即使用新证书，请手动执行：make enable-ssl-params 和 make enable-ssl"
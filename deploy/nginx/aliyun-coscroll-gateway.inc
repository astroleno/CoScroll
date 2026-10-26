# Alibaba HTTPS gateway; include in both .me server blocks.
# The project's static files are served by Tencent over verified TLS.
location = /CoScroll {
    absolute_redirect off;
    return 308 /CoScroll/$is_args$args;
}
location ^~ /CoScroll/ {
    proxy_pass https://122.51.59.89;
    proxy_ssl_server_name on;
    proxy_ssl_name aitoshuu.art;
    proxy_ssl_verify on;
    proxy_ssl_verify_depth 3;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_http_version 1.1;
    proxy_set_header Host aitoshuu.art;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Connection "";
    proxy_cache off;
    proxy_redirect off;
    proxy_connect_timeout 10s;
    set $fv_cache_control "";
    proxy_read_timeout 60s;
}
location = /coscroll { return 308 /CoScroll/$is_args$args; }
location ^~ /coscroll/ {
    if ($request_uri ~ "^/coscroll(/.*)$") { return 308 /CoScroll$1; }
    return 404;
}
# Other mixed-case aliases are handled by project-prefix-canonical.inc.

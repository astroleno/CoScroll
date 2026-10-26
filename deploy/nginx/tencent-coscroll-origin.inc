# Tencent aitoshuu.art HTTPS server. Requires the nine_public_host map.
location = /CoScroll {
    allow 47.103.120.24;
    allow 127.0.0.1;
    deny all;
    if ($nine_public_host = "") { return 403; }
    absolute_redirect off;
    return 308 /CoScroll/$is_args$args;
}
location = /CoScroll/release-health.json {
    allow 47.103.120.24;
    allow 127.0.0.1;
    deny all;
    if ($nine_public_host = "") { return 403; }
    alias /www/wwwroot/coscroll-current/release-health.json;
    default_type application/json;
    add_header Cache-Control no-store always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Project-Origin tencent-shanghai always;
}
location ^~ /CoScroll/ {
    allow 47.103.120.24;
    allow 127.0.0.1;
    deny all;
    if ($nine_public_host = "") { return 403; }
    alias /www/wwwroot/coscroll-current/;
    index index.html;
    try_files $uri $uri/ =404;
    add_header Cache-Control no-cache always;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Project-Origin tencent-shanghai always;
}

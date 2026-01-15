#!/bin/bash

# Sora 2 API 连通性测试脚本

echo "========================================="
echo "Sora 2 API 连通性测试"
echo "========================================="
echo ""

# 从 localStorage 读取 API Key
echo "📌 请提供你的 Sora 2 API Key"
echo "（可以在浏览器控制台执行：localStorage.getItem('sora_storage_config')）"
echo ""
read -p "请输入 API Key: " API_KEY

if [ -z "$API_KEY" ]; then
    echo "❌ API Key 不能为空"
    exit 1
fi

echo ""
echo "🔍 测试端点：https://ai.yijiarj.cn/v1/videos"
echo ""
echo "📦 请求体："
cat << JSON
{
  "prompt": "A beautiful sunset over the ocean",
  "model": "sora-2-10s-large",
  "size": "$API_KEY",
  "is_story": "1"
}
JSON
echo ""
echo "⏳ 发送请求..."
echo ""

# 发送请求
RESPONSE=$(curl --location --request POST 'https://ai.yijiarj.cn/v1/videos' \
--header "Authorization: Bearer $API_KEY" \
--header 'Content-Type: application/json' \
--data-raw "{
  \"prompt\": \"A beautiful sunset over the ocean\",
  \"model\": \"sora-2-10s-large\",
  \"size\": \"$API_KEY\",
  \"is_story\": \"1\"
}" \
--silent --show-error --write-out "\nHTTP_STATUS:%{http_code}")

# 分离 HTTP 状态码和响应体
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "📊 HTTP 状态码: $HTTP_STATUS"
echo ""
echo "📝 响应内容："
echo "$RESPONSE_BODY" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

# 判断结果
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "✅ API 连接成功！"
    echo ""
    # 解析任务 ID
    TASK_ID=$(echo "$RESPONSE_BODY" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
    if [ -n "$TASK_ID" ]; then
        echo "🎬 任务 ID: $TASK_ID"
        echo "📋 查询任务状态："
        echo "curl --location --request GET 'https://ai.yijiarj.cn/v1/videos/$TASK_ID' \\"
        echo "--header 'Authorization: Bearer YOUR_API_KEY'"
    fi
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "❌ 认证失败：API Key 不正确或已过期"
elif [ "$HTTP_STATUS" = "403" ]; then
    echo "❌ 权限不足：API Key 无权限访问此接口"
elif [ "$HTTP_STATUS" = "404" ]; then
    echo "❌ 端点不存在：请检查 API 地址"
elif [ "$HTTP_STATUS" = "429" ]; then
    echo "❌ 请求过于频繁：请稍后重试"
else
    echo "⚠️  请求失败，状态码：$HTTP_STATUS"
fi

echo ""
echo "========================================="

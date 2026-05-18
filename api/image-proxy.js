// 轻量图片代理：服务端拉取远程图片，前端以同源方式加载
// 这是运行在 Vercel Node Runtime 上的 API Route，保持为 JS 文件，
// 这样你的前端 TypeScript 编译（tsc）不会对它做类型检查或报错。

export default async function handler(req, res) {
  const url = req.query && req.query.url;

  if (!url || typeof url !== 'string') {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    const response = await fetch(url);

    if (!response.ok || !response.body) {
      res.status(502).send('Failed to fetch image');
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.status(200).send(buffer);
  } catch (error) {
    console.error('image-proxy error:', error);
    res.status(500).send('Internal server error');
  }
}


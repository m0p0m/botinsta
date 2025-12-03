const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs').promises;

const accountsFilePath = path.join(__dirname, '../../data/accounts.json');
const INSTAGRAM_USER_AGENTS = [
  'Instagram 254.0.0.0.0 Android (32/12; 480dpi; 1080x1920; SAMSUNG; SM-G950F; dreamlte; dreamltecs; en_US; 403699470)',
  'Instagram 260.0.0.0.0 Android (33/13; 420dpi; 1080x2220; realme; RMX2117; RMX2117; RMX2117; en_US; 403699470)',
  'Instagram 280.0.0.0.0 Android (31/12; 420dpi; 1080x2340; OnePlus; GM1910; OnePlus7Pro; OnePlus7Pro; en_US; 403699470)',
  'Instagram 265.0.0.0.0 Android (30/11; 480dpi; 1440x2880; samsung; SM-G973F; beyond2; beyond2; en_US; 403699470)',
  'Instagram 275.0.0.0.0 Android (29/10; 420dpi; 1080x2160; Google; Pixel 3 XL; crosshatch; crosshatch; en_US; 403699470)',
  'Instagram 270.0.0.0.0 Android (31/12; 420dpi; 1080x2340; xiaomi; M2007J1SC; lmi; lmi; en_US; 403699470)',
  'Instagram 282.0.0.0.0 Android (32/12; 420dpi; 1080x2400; OPPO; CPH2127; PBKM00; PBKM00; en_US; 403699470)',
];

/**
 * بازیابی سشن اکانت و ساخت رشته کوکی مناسب
 */
async function getAccountCookie(username) {
  const data = await fs.readFile(accountsFilePath, 'utf8');
  const accounts = JSON.parse(data);
  const account = accounts.find(acc => acc.username === username);
  if (!account || !account.session || !account.session.cookies) throw new Error('No account/session/cookies');
  // ساخت رشته cookie برای header
  return account.session.cookies
    .map(c => `${c.key}=${c.value}`)
    .join('; ');
}

/**
 * دریافت پست‌های هشتگ از طریق اسکرپ وب اینستاگرام
 * @param {string} hashtag هشتگ بدون #
 * @param {string} username نام کاربری که لاگین شده
 * @param {number} [max=12] تعداد پست موردنظر (حداکثر)
 */
async function getHashtagPostsScrape(hashtag, username, max = 12) {
  const cookie = await getAccountCookie(username);
  const userAgent = INSTAGRAM_USER_AGENTS[Math.floor(Math.random() * INSTAGRAM_USER_AGENTS.length)];
  const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Cookie': cookie,
      'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
      'Referer': 'https://www.instagram.com/',
    },
  });
  if (!res.ok) throw new Error('Failed to fetch hashtag page');
  const html = await res.text();
  // لود HTML و استخراج داده موردنظر (در نسخه بعدی کامل می‌کنیم)
  const $ = cheerio.load(html);
  let scriptJson = null;
  $("script[type='application/ld+json'],script[id='__NEXT_DATA__']").each((i, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json && (json['@type'] === 'ItemList' || json.props)) {
        scriptJson = json;
      }
    } catch (e) {}
  });
  // ساده‌ترین روش: تلاش برای استخراج داده از JSON اولیه (اگر پیدا نشد از DOM)
  let posts = [];
  if (scriptJson && scriptJson.props && scriptJson.props.pageProps && scriptJson.props.pageProps.pageData && scriptJson.props.pageProps.pageData.tagMedia && scriptJson.props.pageProps.pageData.tagMedia.edges) {
    posts = scriptJson.props.pageProps.pageData.tagMedia.edges.slice(0, max).map(e => ({
      shortcode: e.node.shortcode,
      url: 'https://www.instagram.com/p/' + e.node.shortcode + '/',
      owner: e.node.owner?.username,
      thumbnail: e.node.thumbnail_src,
      caption: e.node.edge_media_to_caption?.edges?.[0]?.node?.text,
      id: e.node.id
    }));
  } else {
    // Fallback: استخراج لینک و تصویر از DOM HTML
    $("article a").slice(0, max).each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/p/')) {
        const img = $(el).find('img').attr('src');
        posts.push({
          url: 'https://www.instagram.com' + href,
          thumbnail: img || null
        });
      }
    });
  }
  return posts;
}

module.exports = {
  getHashtagPostsScrape,
  // بخش‌های تکمیلی بعدی افزوده خواهد شد (لایک، استخراج کپشن ...)
};

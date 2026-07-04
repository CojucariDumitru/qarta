// Uploads menu photos to Cloudinary under qarta/menu/*.
// Sources: lead images of Wikipedia articles (stable, content-accurate, free-licensed).
// Downloads locally (gentle rate + UA) then uploads the file, resumable.
// Usage: node scripts/upload-images.mjs
import { v2 as cloudinary } from 'cloudinary';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import 'dotenv/config';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UA = 'QartaDemoBot/1.0 (contact: cdakota.dispatch@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DISHES = {
  'salmon-nigiri': ['Sushi'],
  'california-roll': ['California roll'],
  'spicy-tuna-roll': ['Makizushi'],
  'philadelphia-roll': ['Philadelphia roll'],
  'sashimi-platter': ['Sashimi'],
  'tamago-nigiri': ['Tamagoyaki'],
  'tonkotsu-ramen': ['Tonkotsu ramen'],
  'shoyu-ramen': ['Ramen'],
  'spicy-miso-ramen': ['Dandan noodles'],
  'miso-soup': ['Miso soup'],
  'beef-udon': ['Udon'],
  'salmon-onigiri': ['Onigiri'],
  'katsudon': ['Katsudon'],
  'fried-rice': ['Fried rice'],
  'yakitori': ['Yakitori'],
  'beef-skewers': ['Shashlik'],
  'shrimp-skewers': ['Satay'],
  'gyoza': ['Jiaozi', 'Gyoza'],
  'edamame': ['Edamame'],
  'takoyaki': ['Takoyaki'],
  'karaage': ['Karaage'],
  'mochi-ice-cream': ['Mochi ice cream'],
  'matcha-ice-cream': ['Green tea ice cream'],
  'dorayaki': ['Dorayaki'],
  'ramune': ['Ramune'],
  'green-tea': ['Green tea'],
  'jasmine-tea': ['Jasmine tea'],
};

async function fetchRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429) {
      const wait = 8000 * (i + 1);
      console.log(`  429, waiting ${wait / 1000}s…`);
      await sleep(wait);
      continue;
    }
    return res;
  }
  throw new Error('rate limited after retries');
}

async function wikiLeadImage(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title
  )}&prop=pageimages&format=json&pithumbsize=1100&redirects=1`;
  const res = await fetchRetry(url);
  const data = await res.json();
  for (const p of Object.values(data?.query?.pages ?? {})) {
    if (p?.thumbnail?.source) return p.thumbnail.source;
  }
  return null;
}

async function alreadyUploaded(slug) {
  try {
    await cloudinary.api.resource(`qarta/menu/${slug}`);
    return true;
  } catch {
    return false;
  }
}

await mkdir('scripts/.img-cache', { recursive: true });
const failed = [];
for (const [slug, titles] of Object.entries(DISHES)) {
  if (await alreadyUploaded(slug)) {
    console.log(`• ${slug}: already in Cloudinary`);
    continue;
  }
  try {
    const file = `scripts/.img-cache/${slug}.jpg`;
    if (!existsSync(file)) {
      let src = null;
      for (const t of titles) {
        src = await wikiLeadImage(t);
        if (src) break;
        await sleep(1500);
      }
      if (!src) throw new Error('no lead image');
      await sleep(1500);
      const img = await fetchRetry(src);
      if (!img.ok) throw new Error(`download ${img.status}`);
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length < 10_000) throw new Error('image too small');
      await writeFile(file, buf);
      await sleep(2000);
    }
    const up = await cloudinary.uploader.upload(file, {
      public_id: `qarta/menu/${slug}`,
      overwrite: true,
    });
    console.log(`✓ ${slug} (${up.width}x${up.height})`);
  } catch (e) {
    failed.push(slug);
    console.log(`✗ ${slug}: ${e.message}`);
  }
}
console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL UPLOADED');

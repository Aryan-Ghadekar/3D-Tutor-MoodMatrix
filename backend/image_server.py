from fastapi import FastAPI, Query, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import requests
from bs4 import BeautifulSoup
import urllib.parse
import re
import time
import random

app = FastAPI()

# CORS (equivalent to Flask-CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# IMAGE SCRAPER CLASS
# ----------------------------
class ImageScraper:
    def __init__(self):
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
        ]

    def get_random_headers(self):
        return {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    def _get_optimized_image_url(self, img_tag):
        srcset = img_tag.get('srcset')
        if srcset:
            sizes = [s.strip().split(' ')[0] for s in srcset.split(',') if s.strip()]
            if sizes:
                return sizes[0]

        for attr in ['data-src', 'data-original', 'src']:
            val = img_tag.get(attr)
            if val and self._is_valid_image_url(val):
                return self._get_smaller_variant(val)

        return None

    def _get_smaller_variant(self, url):
        if not url:
            return url

        if any(domain in url for domain in ['googleusercontent.com', 'ggpht.com']):
            if '=s' in url:
                url = re.sub(r'=s\d+', '=s300', url)
            else:
                url += '=s300'
        return url

    def search_google_images(self, query, num_results=3):
        search_url = f"https://www.google.com/search?tbm=isch&q={urllib.parse.quote(query)}"

        try:
            response = requests.get(search_url, headers=self.get_random_headers(), timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')

            images = self._extract_from_scripts(soup, num_results)
            if not images:
                images = self._extract_from_img_tags_optimized(soup, num_results)

            return images

        except Exception as e:
            print("Scraping error:", e)
            return []

    def _extract_from_img_tags_optimized(self, soup, num_results):
        images = []
        for img in soup.find_all('img')[1:]:
            url = self._get_optimized_image_url(img)
            if url and self._is_valid_image_url(url) and len(images) < num_results:
                images.append({"url": url, "source": "optimized_img_tag"})
        return images

    def _extract_from_scripts(self, soup, num_results):
        images = []
        for script in soup.find_all('script'):
            if not script.string:
                continue

            matches = re.findall(r'"(https://[^"]*\.(?:jpg|jpeg|png|gif|webp)[^"]*)"', script.string)
            for match in matches:
                if self._is_valid_image_url(match) and len(images) < num_results:
                    images.append({
                        "url": self._get_smaller_variant(match),
                        "source": "script_extraction"
                    })
        return images

    def _is_valid_image_url(self, url):
        if not url.startswith("http"):
            return False
        if any(skip in url.lower() for skip in ['google.com/images', 'gstatic.com', 'logo', 'icon']):
            return False
        return any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'])

scraper = ImageScraper()

# ----------------------------
# API ENDPOINTS
# ----------------------------

@app.get("/optimize_image")
def optimize_image(
    url: str = Query(...),
    width: int = 400,
    height: int = 300
):
    if not url:
        raise HTTPException(status_code=400, detail="Missing image URL")

    if any(k in url.lower() for k in ['=s300', '=s400', 'w=300', 'h=300']):
        return {"optimized_url": url, "source": "already_optimized"}

    return {
        "original_url": url,
        "optimized_url": scraper._get_smaller_variant(url),
        "source": "optimized"
    }


@app.get("/search_image")
def search_image(query: str = Query(...)):
    time.sleep(random.uniform(0.5, 1.5))
    images = scraper.search_google_images(query, num_results=1)

    if images:
        return {
            "query": query,
            "image_url": images[0]["url"],
            "source": images[0]["source"],
            "optimized": True,
            "timestamp": time.time()
        }

    fallback = f"https://via.placeholder.com/300x225/4F46E5/FFFFFF?text={urllib.parse.quote(query)}"
    return {
        "query": query,
        "image_url": fallback,
        "source": "fallback",
        "optimized": True,
        "timestamp": time.time()
    }


@app.post("/batch_search")
def batch_search(payload: Dict = Body(...)):
    queries = payload.get("queries")

    if not queries:
        raise HTTPException(status_code=400, detail="Missing queries")

    if len(queries) > 20:
        raise HTTPException(status_code=400, detail="Max 20 queries allowed")

    results = {}

    for q in queries:
        time.sleep(random.uniform(0.8, 1.5))
        images = scraper.search_google_images(q, num_results=1)
        if images:
            results[q] = images[0]
        else:
            results[q] = {
                "image_url": f"https://via.placeholder.com/300x225?text={urllib.parse.quote(q)}",
                "source": "fallback",
                "optimized": True
            }

    return {"results": results, "timestamp": time.time()}


@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": time.time()}


@app.get("/")
def root():
    return {
        "status": "online",
        "message": "Image Scraper API (FastAPI)",
        "timestamp": time.time()
    }

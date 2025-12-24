from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import urllib.parse
import re
import time
import random
from urllib.parse import urlparse

app = Flask(__name__)
CORS(app)

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
        """Extract the smallest/optimized image URL from available sources"""
        # Try srcset first (contains multiple sizes)
        srcset = img_tag.get('srcset')
        if srcset:
            sizes = [s.strip().split(' ')[0] for s in srcset.split(',') if s.strip()]
            if sizes:
                return sizes[0]  # Usually the smallest size
        
        # Try data-src (lazy loaded)
        data_src = img_tag.get('data-src')
        if data_src and self._is_valid_image_url(data_src):
            return data_src
            
        # Try data-original
        data_original = img_tag.get('data-original')  
        if data_original and self._is_valid_image_url(data_original):
            return data_original
            
        # Fallback to regular src
        src = img_tag.get('src')
        if src and self._is_valid_image_url(src):
            # Try to modify URL for smaller size (works for some image services)
            return self._get_smaller_variant(src)
            
        return src

    def _get_smaller_variant(self, url):
        """Try to get a smaller variant of the image URL"""
        if not url:
            return url
            
        # For images that support size parameters, try to get smaller version
        if any(domain in url for domain in ['googleusercontent.com', 'ggpht.com']):
            # Google images often support size parameters
            if '=s' in url:
                # Replace existing size with smaller one
                url = re.sub(r'=s\d+', '=s300', url)
            elif url.endswith(('jpg', 'jpeg', 'png', 'webp')):
                url += '=s300'
        
        return url

    def search_google_images(self, query, num_results=3):
        """Search Google Images and return optimized image URLs"""
        search_url = f"https://www.google.com/search?tbm=isch&q={urllib.parse.quote(query)}&ijn=0"
        
        try:
            response = requests.get(search_url, headers=self.get_random_headers(), timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Method 1: Look for images in script tags (more reliable)
            images = self._extract_from_scripts(soup, num_results)
            
            if not images:
                # Method 2: Fallback to img tags with optimization
                images = self._extract_from_img_tags_optimized(soup, num_results)
            
            return images
            
        except Exception as e:
            print(f"Error scraping Google Images: {e}")
            return []

    def _extract_from_img_tags_optimized(self, soup, num_results):
        """Extract optimized images from img tags"""
        images = []
        img_tags = soup.find_all('img')
        
        for img in img_tags[1:]:  # Skip first (usually Google logo)
            optimized_url = self._get_optimized_image_url(img)
            
            if optimized_url and self._is_valid_image_url(optimized_url) and len(images) < num_results:
                images.append({
                    'url': optimized_url,
                    'source': 'optimized_img_tag'
                })
        
        return images

    def _extract_from_scripts(self, soup, num_results):
        """Extract image URLs from JavaScript data in script tags"""
        images = []
        scripts = soup.find_all('script')
        
        for script in scripts:
            if script.string:
                # Look for smaller image URLs in JavaScript
                # Match smaller resolution patterns first
                small_matches = re.findall(r'"(https://[^"]*\.(?:jpg|jpeg|png|gif|webp)[^"]*(?:=s[1-4]\d{2}|w=\d{3}|h=\d{3})[^"]*)"', script.string)
                
                for match in small_matches:
                    if self._is_valid_image_url(match) and len(images) < num_results:
                        images.append({
                            'url': match,
                            'source': 'script_extraction_small'
                        })
                
                # If no small images found, look for regular ones but try to optimize
                if len(images) < num_results:
                    matches = re.findall(r'"(https://[^"]*\.(?:jpg|jpeg|png|gif|webp))"', script.string)
                    for match in matches:
                        if self._is_valid_image_url(match) and len(images) < num_results:
                            optimized_url = self._get_smaller_variant(match)
                            images.append({
                                'url': optimized_url,
                                'source': 'script_extraction'
                            })
        
        return images

    def _is_valid_image_url(self, url):
        """Check if URL is a valid image URL"""
        if not url or not url.startswith('http'):
            return False
        
        # Skip Google's own images and logos
        if any(skip in url.lower() for skip in ['google.com/images', 'gstatic.com', 'logo', 'icon']):
            return False
        
        # Check file extension or image indicators
        if any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '&imgurl=', 'images']):
            return True
        
        return False

scraper = ImageScraper()

# Add image optimization endpoint
@app.route('/optimize_image')
def optimize_image():
    """Return optimized/resized image URL"""
    image_url = request.args.get('url', '').strip()
    width = request.args.get('width', '400')
    height = request.args.get('height', '300')
    
    if not image_url:
        return jsonify({'error': 'Missing image URL'}), 400
    
    # If it's already a small image, return as is
    if any(indicator in image_url.lower() for indicator in ['=s300', '=s400', 'w=300', 'h=300']):
        return jsonify({
            'optimized_url': image_url,
            'source': 'already_optimized'
        })
    
    # Try to create optimized URL
    optimized_url = scraper._get_smaller_variant(image_url)
    
    return jsonify({
        'original_url': image_url,
        'optimized_url': optimized_url,
        'source': 'optimized'
    })

# Keep your existing endpoints but they now return optimized images automatically
@app.route('/search_image', methods=['GET'])
def search_image():
    """Single image search endpoint with optimization"""
    query = request.args.get('query', '').strip()
    
    if not query:
        return jsonify({'error': 'Missing query parameter'}), 400
    
    time.sleep(random.uniform(0.5, 1.5))
    
    images = scraper.search_google_images(query, num_results=1)
    
    if images:
        return jsonify({
            'query': query,
            'image_url': images[0]['url'],
            'source': images[0]['source'],
            'optimized': True,
            'timestamp': time.time()
        })
    else:
        # Smaller fallback image
        fallback_url = f"https://via.placeholder.com/300x225/4F46E5/FFFFFF?text={urllib.parse.quote(query)}"
        return jsonify({
            'query': query,
            'image_url': fallback_url,
            'source': 'fallback',
            'optimized': True,
            'timestamp': time.time()
        })

@app.route('/batch_search', methods=['POST'])
def batch_search():
    """Batch search with optimized images"""
    data = request.get_json()
    
    if not data or 'queries' not in data:
        return jsonify({'error': 'Missing queries in request body'}), 400
    
    queries = data['queries']
    if len(queries) > 20:
        return jsonify({'error': 'Too many queries. Maximum 20 allowed.'}), 400
    
    results = {}
    
    for query in queries:
        time.sleep(random.uniform(0.8, 1.5))  # Slightly faster for optimized images
        images = scraper.search_google_images(query.strip(), num_results=1)
        
        if images:
            results[query] = {
                'image_url': images[0]['url'],
                'source': images[0]['source'],
                'optimized': True
            }
        else:
            fallback_url = f"https://via.placeholder.com/300x225/4F46E5/FFFFFF?text={urllib.parse.quote(query)}"
            results[query] = {
                'image_url': fallback_url,
                'source': 'fallback',
                'optimized': True
            }
    
    return jsonify({
        'results': results,
        'timestamp': time.time()
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': time.time()})

@app.route('/')
def index():
    """Root endpoint for Vercel deployment"""
    return jsonify({
        'status': 'online',
        'message': 'Image Scraper API is running. See README for available endpoints.',
        'timestamp': time.time()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

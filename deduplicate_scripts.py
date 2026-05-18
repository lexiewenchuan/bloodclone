import os
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

JUBEN_DIR = os.path.abspath("public/juben")

def get_role_fingerprint(data):
    """
    Extracts a unique fingerprint for a script based on its roles.
    Fingerprint is a sorted tuple of role names (Townsfolk, Outsider, Minion, Demon).
    Ignores order and metadata.
    Handles both list-of-dicts and dict-of-lists formats.
    """
    roles = set()
    valid_teams = {"townsfolk", "outsider", "minion", "demon"}
    
    # Format 1: List of dictionaries (Standard JSON format often used in tools)
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                # Check if it's a role
                team = item.get("team")
                if team in valid_teams:
                    name = item.get("name")
                    if name:
                        roles.add(name)
                        
    # Format 2: Dictionary with keys for teams (Some custom formats)
    elif isinstance(data, dict):
        for role_type in valid_teams:
            if role_type in data:
                for role in data[role_type]:
                    if isinstance(role, str):
                        roles.add(role)
                    elif isinstance(role, dict) and "name" in role:
                        roles.add(role["name"])
    
    if not roles:
        return None
        
    return tuple(sorted(list(roles)))

def extract_meta(data):
    """
    Helper to extract metadata from data (list or dict).
    """
    if isinstance(data, list):
        # Usually the first item with id="_meta" or just the first item
        for item in data:
            if item.get("id") == "_meta":
                return item
        # Fallback: check if first item looks like meta (has name, author but no team)
        if data and isinstance(data[0], dict) and "name" in data[0] and "team" not in data[0]:
            return data[0]
        return {}
    elif isinstance(data, dict):
        return data.get("_meta", {})
    return {}

def has_special_roles(data, role_type):
    """
    Checks if data has roles of a specific type (e.g., "traveler", "fabled").
    """
    target_teams = {role_type}
    if role_type == "travelers": target_teams = {"traveler", "travelers"}
    if role_type == "fabled": target_teams = {"fabled"}
    
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("team") in target_teams:
                return True
    elif isinstance(data, dict):
        # Check specific keys if they exist
        if role_type in data and data[role_type]:
            return True
        # Also check inside mixed lists if any
    return False

def check_url_valid(url):
    """
    Checks if a URL is accessible (returns 200 OK) using a HEAD request.
    Returns True if valid, False otherwise.
    """
    if not url or not url.startswith("http"):
        return False
    
    try:
        req = urllib.request.Request(
            url, 
            method="HEAD", 
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except Exception:
        return False

def score_script_entry(file_path, data):
    """
    Scores a script entry based on completeness and validity of external resources.
    Returns a tuple: (score, is_logo_valid)
    """
    score = 0
    meta = extract_meta(data)
    
    # 1. Check Logo
    logo_url = meta.get("logo")
    is_logo_valid = False
    if logo_url:
        is_logo_valid = check_url_valid(logo_url)
        if is_logo_valid:
            score += 1000
    
    # 2. Check Content Completeness
    if has_special_roles(data, "travelers"):
        score += 10
    if has_special_roles(data, "fabled"):
        score += 10
        
    return score

def process_file(file_path):
    """
    Reads a file and returns its fingerprint and data.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Basic validation: must have valid roles
        fingerprint = get_role_fingerprint(data)
        if not fingerprint:
            return None
            
        return {
            "path": file_path,
            "data": data,
            "fingerprint": fingerprint
        }
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None

def deduplicate_folder(folder_path):
    """
    Deduplicates scripts within a single folder.
    """
    print(f"Scanning {folder_path}...")
    files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.endswith(".json")]
    if not files:
        return
    
    # Group by fingerprint
    grouped = defaultdict(list)
    for file_path in files:
        result = process_file(file_path)
        if result:
            grouped[result["fingerprint"]].append(result)
            
    # Check for duplicates
    for fingerprint, items in grouped.items():
        if len(items) > 1:
            print(f"Found {len(items)} duplicates for fingerprint in {folder_path}")
            
            # Score items
            scored_items = []
            for item in items:
                score = score_script_entry(item["path"], item["data"])
                scored_items.append((score, item))
            
            # Sort by score descending
            scored_items.sort(key=lambda x: x[0], reverse=True)
            
            # Keep the best one, delete others
            best_item = scored_items[0][1]
            print(f"Keeping: {os.path.basename(best_item['path'])} (Score: {scored_items[0][0]})")
            
            for score, item in scored_items[1:]:
                print(f"Deleting: {os.path.basename(item['path'])} (Score: {score})")
                try:
                    os.remove(item["path"])
                except Exception as e:
                    print(f"Error deleting {item['path']}: {e}")

def main():
    target_dir = input("Enter directory to deduplicate (default: public/juben): ").strip()
    if not target_dir:
        target_dir = JUBEN_DIR
    else:
        target_dir = os.path.abspath(target_dir)
        
    print(f"Starting deduplication in {target_dir}")
    
    # Iterate all subdirectories
    for root, dirs, files in os.walk(target_dir):
        deduplicate_folder(root)
        
    print("Deduplication complete.")

if __name__ == "__main__":
    main()

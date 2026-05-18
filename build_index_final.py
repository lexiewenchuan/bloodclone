import os
import sys
import json
import urllib.request
import urllib.parse
import hashlib
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

JUBEN_DIR = os.path.abspath("public/juben")
OUTPUT_FILE = os.path.abspath("public/scripts.json")
DOWNLOAD_DIR = os.path.abspath("public/image/downloaded")

VALID_CORE_TEAMS = {"townsfolk", "outsider", "minion", "demon"}

# ==================== 名称清洗逻辑 ====================

def clean_name(name):
    """
    清洗剧本名称，去除 #前缀、数字前缀、作者后缀等
    返回 (清洗后的名称, 是否被清洗, 清洗原因列表)
    """
    if not name or not isinstance(name, str):
        return name, False, []
    
    cleaned = name.strip()
    original = cleaned
    reasons = []
    
    # 规则1: 去除 # 前缀
    if cleaned.startswith('#'):
        cleaned = cleaned[1:].strip()
        reasons.append('去除#前缀')
    
    # 规则2: 去除 数字# 前缀 (如 666#旁观者清)
    import re
    num_hash_match = re.match(r'^(\d+)#(.+)$', cleaned)
    if num_hash_match:
        cleaned = num_hash_match.group(2).strip()
        reasons.append('去除数字#前缀')
    
    # 规则3: 去除 数字_ 前缀 (如 1_866_劳资蜀道山)
    num_underscore_match = re.match(r'^(\d+_)+(.+)$', cleaned)
    if num_underscore_match:
        cleaned = num_underscore_match.group(2).strip()
        reasons.append('去除数字_前缀')
    
    # 规则4: 去除 -作者名 后缀
    # 作者名可以包含字母、数字、空格、下划线
    author_match = re.match(r'^(.+?)(\s*-\s*[A-Za-z][A-Za-z0-9_\s]*)$', cleaned)
    if author_match:
        before_author = author_match.group(1).strip()
        if before_author and len(before_author) > 0:
            cleaned = before_author
            reasons.append('去除作者后缀')
    
    was_cleaned = cleaned != original
    return cleaned, was_cleaned, reasons


def clean_script_name(data):
    """
    在剧本数据中查找并清洗名称
    返回 (是否修改, 原名称, 新名称, 原因)
    """
    if not isinstance(data, list):
        return False, None, None, []
    
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        
        # 判断是否为 meta 项
        is_meta = (item.get("id") == "_meta" or 
                   (item.get("name") and not item.get("team") and not item.get("ability")) or
                   (item.get("name") and item.get("author") and not item.get("team")))
        
        if is_meta and item.get("name"):
            cleaned_name, was_cleaned, reasons = clean_name(item["name"])
            if was_cleaned:
                original_name = item["name"]
                item["name"] = cleaned_name
                item["original_name"] = original_name
                return True, original_name, cleaned_name, reasons
            break
    
    return False, None, None, []


def collect_script_files():
    """递归收集所有剧本 JSON 文件"""
    all_files = []
    for root, dirs, files in os.walk(JUBEN_DIR):
        for file in files:
            if file.endswith(".json") and not file.startswith("."):
                all_files.append(os.path.join(root, file))
    return all_files


def read_json_with_bom(file_path):
    """读取 JSON，兼容 UTF-8 BOM"""
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        return json.load(f)


def write_beautiful_json(file_path, data):
    """写入格式化后的 JSON（Beautiful JSON）"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def has_non_empty_text(value):
    return isinstance(value, str) and value.strip() != ""


def extract_meta_for_validation(data):
    """提取 meta 数据，仅用于预检"""
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("id") == "_meta":
                return item

        for item in data:
            if not isinstance(item, dict):
                continue
            if item.get("name") and not item.get("team") and not item.get("ability"):
                return item

    elif isinstance(data, dict):
        meta = data.get("_meta")
        if isinstance(meta, dict):
            return meta

    return None


def has_valid_core_role_for_precheck(data):
    """
    至少存在一个核心阵营角色：
    - team 为 townsfolk/outsider/minion/demon
    - 且 name、ability 都完整
    """
    if not isinstance(data, list):
        return False

    for item in data:
        if not isinstance(item, dict):
            continue

        team = item.get("team")
        if not isinstance(team, str):
            continue

        team_text = team.strip()
        if not team_text:
            continue

        is_core_team = team_text.lower() in VALID_CORE_TEAMS
        if not is_core_team:
            continue

        if has_non_empty_text(item.get("name")) and has_non_empty_text(item.get("ability")):
            return True

    return False


def validate_script_for_precheck(data):
    """返回 (是否有效, 原因列表)"""
    reasons = []

    if not isinstance(data, (list, dict)):
        return False, ["文件内容不是合法的 JSON 对象或数组"]

    meta = extract_meta_for_validation(data)
    if not meta or not has_non_empty_text(meta.get("name")):
        reasons.append("缺少剧本 meta 数据（至少需要 name）")

    if not has_valid_core_role_for_precheck(data):
        reasons.append("缺少核心阵营有效角色（team 为 townsfolk/outsider/minion/demon，且 name、ability 完整）")

    return len(reasons) == 0, reasons


def confirm_invalid_scripts_deletion(invalid_scripts):
    """列出无效剧本并要求用户确认删除"""
    if not invalid_scripts:
        return True

    print("\n⚠️ 发现以下无效剧本：")
    for idx, item in enumerate(invalid_scripts, 1):
        print(f"  {idx}. {item['relative_path']}")
        print(f"     原因: {'；'.join(item['reasons'])}")

    if not (sys.stdin.isatty() and sys.stdout.isatty()):
        print("\n⛔ 当前环境不支持交互确认，已终止执行，未删除任何文件")
        return False

    answer = input("\n是否删除以上无效剧本并继续构建？输入 yes 继续: ").strip().lower()
    return answer in {"yes", "y"}


def precheck_and_format_scripts():
    """预检全部剧本并格式化有效剧本为 Beautiful JSON"""
    print("=" * 60)
    print("预检阶段：有效性校验 + Beautiful JSON 格式化")
    print("=" * 60)

    all_files = collect_script_files()
    valid_scripts = []
    invalid_scripts = []

    for file_path in all_files:
        relative_path = os.path.relpath(file_path, JUBEN_DIR).replace(os.sep, "/")

        try:
            data = read_json_with_bom(file_path)
        except Exception as e:
            invalid_scripts.append({
                "path": file_path,
                "relative_path": relative_path,
                "reasons": [f"JSON 解析失败: {e}"]
            })
            continue

        is_valid, reasons = validate_script_for_precheck(data)
        if is_valid:
            valid_scripts.append((file_path, data))
        else:
            invalid_scripts.append({
                "path": file_path,
                "relative_path": relative_path,
                "reasons": reasons
            })

    print(f"扫描文件: {len(all_files)}")
    print(f"有效剧本: {len(valid_scripts)}")
    print(f"无效剧本: {len(invalid_scripts)}")

    if invalid_scripts and not confirm_invalid_scripts_deletion(invalid_scripts):
        print("\n⛔ 用户取消或无法确认，构建流程已终止")
        return False

    deleted_count = 0
    for item in invalid_scripts:
        try:
            os.remove(item["path"])
            deleted_count += 1
        except Exception as e:
            print(f"\n⛔ 删除失败: {item['relative_path']} -> {e}")
            return False

    if deleted_count > 0:
        print(f"🗑️ 已删除 {deleted_count} 个无效剧本")

    for file_path, data in valid_scripts:
        write_beautiful_json(file_path, data)

    print(f"✨ 已将 {len(valid_scripts)} 个有效剧本格式化为 Beautiful JSON")
    return True


# ==================== 图片处理逻辑 ====================

def get_hash_filename(url):
    """根据 URL 生成 MD5 哈希文件名"""
    hash_val = hashlib.md5(url.encode('utf-8')).hexdigest()
    return f"{hash_val}.webp"


def get_local_image_path(url):
    """获取图片的本地路径（相对 web 根目录，不带 base 前缀）"""
    filename = get_hash_filename(url)
    return f"/image/downloaded/{filename}"


def get_local_image_full_path(url):
    """获取图片的完整本地文件系统路径"""
    local_path = get_local_image_path(url)
    return os.path.join(os.path.dirname(JUBEN_DIR), local_path.lstrip('/'))


def is_image_downloaded(url):
    """检查图片是否已经下载到本地"""
    full_path = get_local_image_full_path(url)
    return os.path.exists(full_path)


def collect_images_from_script(data):
    """
    从剧本数据中收集所有需要下载的图片
    返回 {
        "to_download": [(url, filename, type, index), ...],  # 需要新下载的
        "to_update_local": [(type, index, local_path), ...]  # 已存在，可直接复用本地的
    }
    """
    to_download = []
    to_update_local = []
    
    if not isinstance(data, list):
        return to_download, to_update_local
    
    # 查找 meta 中的 logo
    meta = extract_meta(data)
    if meta and meta.get("logo"):
        logo_url = meta["logo"]
        if logo_url.startswith("http"):
            local_path = get_local_image_path(logo_url)
            if is_image_downloaded(logo_url):
                to_update_local.append(("logo", None, local_path))
            else:
                filename = get_hash_filename(logo_url)
                to_download.append((logo_url, filename, "logo", None))
    
    # 查找角色图片
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        if item.get("image") and item["image"].startswith("http"):
            img_url = item["image"]
            local_path = get_local_image_path(img_url)
            if is_image_downloaded(img_url):
                to_update_local.append(("role", i, local_path))
            else:
                filename = get_hash_filename(img_url)
                to_download.append((img_url, filename, "role", i))
    
    return to_download, to_update_local


def update_image_paths_in_data(data, updates):
    """在剧本数据中更新图片路径为本地路径"""
    if not isinstance(data, list):
        return
    
    for update_type, index, local_path in updates:
        if update_type == "logo":
            meta = extract_meta(data)
            if meta:
                meta["original_logo"] = meta.get("logo")
                meta["logo"] = local_path
        elif update_type == "role" and index is not None and 0 <= index < len(data):
            if isinstance(data[index], dict):
                data[index]["original_image"] = data[index].get("image")
                data[index]["image"] = local_path


def download_single_image(url, filename):
    """
    下载单张图片并转换为 webp 格式
    返回 (是否成功, 错误信息)
    """
    try:
        import urllib.request
        import subprocess
        
        full_path = os.path.join(DOWNLOAD_DIR, filename)
        
        # 确保下载目录存在
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        
        # 下载图片
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        with urllib.request.urlopen(req, timeout=15) as response:
            image_data = response.read()
        
        # 使用 pillow 转换为 webp
        try:
            from PIL import Image
            import io
            
            img = Image.open(io.BytesIO(image_data))
            # 转换为 RGB（去除透明通道，webp 支持透明度但统一处理）
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGBA')
            else:
                img = img.convert('RGB')
            
            img.save(full_path, 'WEBP', quality=80)
        except Exception as e:
            # 如果 pillow 失败，尝试直接保存原始数据
            with open(full_path, 'wb') as f:
                f.write(image_data)
        
        return True, None
        
    except Exception as e:
        return False, str(e)


def download_images_concurrently(download_list, max_workers=20):
    """
    并发下载图片列表
    download_list: [(url, filename), ...]
    返回 {url: (success, error_or_none)}
    """
    results = {}
    
    def download_task(url_filename):
        url, filename = url_filename
        success, error = download_single_image(url, filename)
        return url, (success, error)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(download_task, item) for item in download_list]
        for future in futures:
            url, result = future.result()
            results[url] = result
    
    return results


# ==================== 原逻辑（修改后） ====================

def normalize_team(team_text: str):
    """
    标准化 team 字段到固定枚举：
    townsfolk / outsider / minion / demon / fabled / traveler / jinxed
    同时兼容常见中文写法。
    """
    if not isinstance(team_text, str):
        return None
    s = team_text.strip()
    if not s:
        return None

    lower = s.lower()
    if lower in {"townsfolk"}:
        return "townsfolk"
    if lower in {"outsider"}:
        return "outsider"
    if lower in {"minion"}:
        return "minion"
    if lower in {"demon"}:
        return "demon"
    if lower in {"fabled"}:
        return "fabled"
    if lower in {"traveler", "traveller"}:
        return "traveler"
    if lower in {"jinx", "jinxed"}:
        return "jinxed"

    no_space = s.replace(" ", "")

    if any(key in no_space for key in ["镇民", "好人", "善良镇民", "善良阵营"]):
        return "townsfolk"
    if any(key in no_space for key in ["外来者", "外乡人"]):
        return "outsider"
    if any(key in no_space for key in ["爪牙", "随从", "帮凶"]):
        return "minion"
    if any(key in no_space for key in ["恶魔", "魔王"]):
        return "demon"
    if any(key in no_space for key in ["传奇", "传说"]) or "fabled" in lower:
        return "fabled"
    if any(key in no_space for key in ["旅人", "旅客", "旅行者"]):
        return "traveler"
    if any(key in no_space for key in ["相克", "克制"]) or "jinx" in lower:
        return "jinxed"

    return None


def extract_role_name_sets(data):
    """
    从剧本数据中提取三类角色名称集合：
    - core_names: townsfolk/outsider/minion/demon
    - fabled_names: fabled
    - jinxed_names: jinxed
    返回 (core_names_sorted_list, fabled_names_sorted_list, jinxed_names_sorted_list)
    """
    core = set()
    fabled = set()
    jinxed = set()

    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        # dict 形式：可能有 "townsfolk" 等 key
        items = []
        for v in data.values():
            if isinstance(v, list):
                items.extend(v)
    else:
        return [], [], []

    for item in items:
        if not isinstance(item, dict):
            continue
        team_raw = item.get("team")
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        team = normalize_team(team_raw) if team_raw is not None else None
        if team in {"townsfolk", "outsider", "minion", "demon"}:
            core.add(name.strip())
        elif team == "fabled":
            fabled.add(name.strip())
        elif team == "jinxed":
            jinxed.add(name.strip())

    return (
        sorted(core),
        sorted(fabled),
        sorted(jinxed),
    )


def canonicalize_json(value):
    """
    将 JSON 递归规范化（object 的 key 排序），用于生成稳定指纹。
    """
    if isinstance(value, list):
        return [canonicalize_json(v) for v in value]
    if isinstance(value, dict):
        return {k: canonicalize_json(value[k]) for k in sorted(value.keys())}
    return value


def compute_fingerprints_for_data(data):
    """
    计算三种指纹：
    - fingerprint_core: 只看 core 阵营角色名称集合
    - fingerprint_roles: core + fabled + jinxed 各自名称集合
    - fingerprint_full: 完整规范化 JSON
    返回 dict，并包含 core_role_count 方便估算最小人数。
    """
    core_names, fabled_names, jinxed_names = extract_role_name_sets(data)

    if not core_names:
        return None

    # F1: 核心角色集合
    payload_core = json.dumps(core_names, ensure_ascii=False, separators=(",", ":"))
    fp_core = hashlib.sha256(payload_core.encode("utf-8")).hexdigest()

    # F2: 全部角色集合（仅名称）
    payload_roles = json.dumps(
        {"core": core_names, "fabled": fabled_names, "jinxed": jinxed_names},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    fp_roles = hashlib.sha256(payload_roles.encode("utf-8")).hexdigest()

    # F3: 完整 JSON
    canonical = canonicalize_json(data)
    payload_full = json.dumps(canonical, ensure_ascii=False, separators=(",", ":"))
    fp_full = hashlib.sha256(payload_full.encode("utf-8")).hexdigest()

    return {
        "fingerprint_core": fp_core,
        "fingerprint_roles": fp_roles,
        "fingerprint_full": fp_full,
        "core_role_count": len(core_names),
    }

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

def is_logo_valid(logo_path):
    """
    检查 logo 是否有效（支持远程 URL 和本地路径）
    """
    if not logo_path:
        return False
    
    # 如果是远程 URL，检查可访问性
    if logo_path.startswith("http"):
        return check_url_valid(logo_path)
    
    # 如果是本地路径，检查文件是否存在
    # 路径格式: /image/downloaded/xxx.webp 或 /blood-on-the-clocktower/image/downloaded/xxx.webp
    if logo_path.startswith("/"):
        # 尝试两种路径格式
        possible_paths = [
            logo_path.lstrip("/"),  # image/downloaded/xxx.webp
            logo_path.replace("/blood-on-the-clocktower/", "").lstrip("/")  # 去除前缀
        ]
        for rel_path in possible_paths:
            full_path = os.path.join(os.path.dirname(JUBEN_DIR), rel_path)
            if os.path.exists(full_path):
                return True
    
    return False


def score_script_entry(file_path, data):
    """
    Scores a script entry based on completeness and validity of external resources.
    Returns a tuple: (score, is_logo_valid)
    """
    score = 0
    meta = extract_meta(data)
    
    # 1. Check Logo
    logo_path = meta.get("logo")
    logo_is_valid = False
    if logo_path:
        logo_is_valid = is_logo_valid(logo_path)
        if logo_is_valid:
            score += 1000
    
    # 2. Check Content Completeness
    if has_special_roles(data, "travelers"):
        score += 10
    if has_special_roles(data, "fabled"):
        score += 10
        
    return score, logo_is_valid

def process_file(file_path):
    """
    读取单个剧本文件并返回数据与指纹信息。
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        fp_info = compute_fingerprints_for_data(data)
        if not fp_info:
            return None

        return {
            "path": file_path,
            "data": data,
            **fp_info,
        }
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None


def main():
    if not precheck_and_format_scripts():
        return

    # ==================== 阶段1：名称清洗 + 智能图片收集 ====================
    print("=" * 60)
    print("阶段1：名称清洗 + 智能图片收集")
    print("=" * 60)

    all_files = collect_script_files()

    print(f"扫描到 {len(all_files)} 个文件")
    
    # 收集所有需要下载的图片（去重）
    all_images_to_download = {}  # url -> filename
    all_local_updates = []  # 每个文件的本地路径更新
    name_clean_stats = {"count": 0, "details": []}
    
    for file_path in all_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"  [跳过] 无法解析 {file_path}: {e}")
            continue
        
        # 1. 名称清洗
        was_cleaned, orig_name, new_name, reasons = clean_script_name(data)
        if was_cleaned:
            name_clean_stats["count"] += 1
            name_clean_stats["details"].append({
                "file": os.path.basename(file_path),
                "original": orig_name,
                "cleaned": new_name,
                "reasons": reasons
            })
            print(f"  [清洗] {os.path.basename(file_path)}: '{orig_name}' -> '{new_name}' ({', '.join(reasons)})")
        
        # 2. 收集图片
        to_download, to_update_local = collect_images_from_script(data)
        
        # 立即更新已存在的本地路径
        if to_update_local:
            update_image_paths_in_data(data, to_update_local)
        
        # 收集需要下载的图片（去重）
        for url, filename, img_type, index in to_download:
            if url not in all_images_to_download:
                all_images_to_download[url] = filename
        
        # 保存收集到的待更新信息（用于下载完成后更新）
        all_local_updates.append({
            "file_path": file_path,
            "data": data,
            "to_update_local": to_update_local,
            "to_download": to_download,
            "was_cleaned": was_cleaned
        })
        
        # 如果有名称清洗或本地路径更新，立即保存文件
        if was_cleaned or to_update_local:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n名称清洗完成: {name_clean_stats['count']} 个文件被修改")
    print(f"本地图片复用: {sum(len(u['to_update_local']) for u in all_local_updates)} 张")
    print(f"待下载新图片: {len(all_images_to_download)} 张")
    
    # ==================== 阶段2：并发下载新图片 ====================
    if all_images_to_download:
        print("\n" + "=" * 60)
        print("阶段2：并发下载新图片")
        print("=" * 60)
        
        download_list = list(all_images_to_download.items())  # [(url, filename), ...]
        download_results = download_images_concurrently(download_list, max_workers=20)
        
        success_count = sum(1 for success, _ in download_results.values() if success)
        fail_count = len(download_results) - success_count
        
        print(f"下载完成: {success_count} 成功, {fail_count} 失败")
        
        # 更新下载成功的图片路径到剧本文件
        print("更新剧本文件中的图片路径...")
        for update_info in all_local_updates:
            file_path = update_info["file_path"]
            data = update_info["data"]
            to_download = update_info["to_download"]
            
            # 找出下载成功的图片并更新路径
            successful_updates = []
            for url, filename, img_type, index in to_download:
                if download_results.get(url, (False, None))[0]:  # 下载成功
                    local_path = get_local_image_path(url)
                    successful_updates.append((img_type, index, local_path))
            
            if successful_updates:
                update_image_paths_in_data(data, successful_updates)
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
    else:
        print("\n没有新图片需要下载")
    
    # ==================== 阶段3：构建索引 ====================
    print("\n" + "=" * 60)
    print("阶段3：构建索引")
    print("=" * 60)
    
    # Group by fingerprint（基于核心角色集合指纹合并相同剧本）
    grouped_scripts = defaultdict(list)
    
    for file_path in all_files:
        result = process_file(file_path)
        if result:
            grouped_scripts[result["fingerprint_core"]].append(result)
            
    print(f"从 {len(all_files)} 个文件中识别出 {len(grouped_scripts)} 个唯一剧本")
    
    final_index = []
    
    # Second pass: Score and select best version for each group
    # This involves network requests, so we use ThreadPoolExecutor
    print("Scoring scripts and verifying resources (this may take a while)...")
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        # We need to process each group
        # To avoid race conditions, we'll process groups one by one but parallelize the scoring within?
        # Actually, we can just map a function that takes a group and returns the best entry.
        
        def process_group(fingerprint_core, items):
            # Calculate score for each item in the group
            scored_items = []
            for item in items:
                score, is_logo_valid = score_script_entry(item["path"], item["data"])
                scored_items.append({
                    **item,
                    "score": score,
                    "is_logo_valid": is_logo_valid
                })
            
            # Sort by score descending
            scored_items.sort(key=lambda x: x["score"], reverse=True)
            best_item = scored_items[0]
            
            # Aggregate types (folder names)
            types = set()
            for item in items:
                # Extract folder name relative to JUBEN_DIR
                rel_dir = os.path.dirname(os.path.relpath(item["path"], JUBEN_DIR))
                # If file is directly in JUBEN_DIR, type might be empty or "."
                if rel_dir and rel_dir != ".":
                    # Use the first component if it's nested? Or the full path?
                    # User said "parent folder name is the type"
                    # Usually "official/Bad Moon Rising.json" -> type="official"
                    folder_name = os.path.basename(rel_dir)
                    if folder_name != "未分类":
                        types.add(folder_name)
            
            # Prepare final entry
            meta = extract_meta(best_item["data"])
            
            # 优先使用 metadata 中的 name，如果没有则使用文件名（去除扩展名）
            name = meta.get("name")
            if not name:
                name = os.path.splitext(os.path.basename(best_item["path"]))[0]
                # 尝试从文件名中提取更干净的名字 (去除前面的数字前缀等)
                # 例如 "1_811#神不在的第四日" -> "神不在的第四日"
                if "_" in name:
                    parts = name.split("_")
                    if len(parts) > 1 and parts[0].isdigit():
                        name = "_".join(parts[1:])
            
            author = meta.get("author", "Unknown")
            # 直接使用 meta 中的 logo（本地路径或远程URL）
            logo = meta.get("logo")
            # 过滤掉空字符串
            if logo and not isinstance(logo, str):
                logo = None
            # 去除 /blood-on-the-clocktower/ 前缀（如果有），因为 Vite base 已经包含这个前缀
            if logo and logo.startswith('/blood-on-the-clocktower/'):
                logo = logo.replace('/blood-on-the-clocktower/', '/')
            # 确保本地路径以 / 开头
            if logo and not logo.startswith('http') and not logo.startswith('/'):
                logo = '/' + logo
            
            # Calculate min_players (based on role count in fingerprint)
            min_players = best_item.get("core_role_count", 0)
            
            # Generate web-accessible path（与磁盘路径一致，不要做 URL 编码）
            # 前端请求剧本时用 src/utils/scriptUrl.ts 的 buildScriptFetchUrl(path) 构造 URL 并做编码，
            # 此处只写「相对 public/ 的原始路径」，保证 path 与文件名一致（含 +、空格等也原样保留）。
            # Previous scripts.json used /public/juben/... so we should match that.
            # JUBEN_DIR is /.../public/juben
            # So if file is /.../public/juben/A/B.json, web path should be juben/A/B.json
            project_public_root = os.path.dirname(JUBEN_DIR)
            rel_path = os.path.relpath(best_item["path"], project_public_root)
            web_path = rel_path.replace("\\", "/").lstrip("/")
            
            return {
                "name": name,
                "author": author,
                "logo": logo,
                "types": sorted(list(types)),
                "min_players": min_players,
                "path": web_path,
                "fingerprint_core": best_item.get("fingerprint_core"),
                "fingerprint_roles": best_item.get("fingerprint_roles"),
                "fingerprint_full": best_item.get("fingerprint_full"),
            }

        # Submit all groups
        futures = []
        for fingerprint, items in grouped_scripts.items():
            futures.append(executor.submit(process_group, fingerprint, items))
            
        for future in futures:
            result = future.result()
            final_index.append(result)
            
    # Sort index by name for consistency
    final_index.sort(key=lambda x: x["name"])
    
    print(f"Writing {len(final_index)} entries to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_index, f, ensure_ascii=False, indent=2)
        
    print("Done!")

if __name__ == "__main__":
    main()

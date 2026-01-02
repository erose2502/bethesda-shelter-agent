"""Script to load shelter policies into Pinecone.

This script now loads all .yaml/.yml files from the `data/policies/`
directory. If no policy files are present it exits gracefully.

This avoids hard-coding a single sample file so we can safely remove
sample/mock policy files from the repo without breaking the script.
"""

import os
import sys
import glob
import yaml
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

try:
    from openai import OpenAI
    from pinecone import Pinecone
except Exception:
    OpenAI = None
    Pinecone = None

ROOT = os.path.dirname(os.path.dirname(__file__))
POLICIES_DIR = os.path.join(ROOT, 'data', 'policies')

def gather_policies():
    files = []
    for ext in ('*.yaml', '*.yml'):
        files.extend(glob.glob(os.path.join(POLICIES_DIR, ext)))
    policies = []
    for path in sorted(files):
        try:
            with open(path, 'r') as f:
                data = yaml.safe_load(f) or {}
                p = data.get('policies')
                if p:
                    policies.extend(p)
        except Exception as e:
            print(f"⚠️  Failed to load {path}: {e}")
    return policies

def main():
    policies = gather_policies()
    if not policies:
        print("ℹ️  No policy files found in data/policies/. Nothing to load.")
        return

    print(f"📄 Loading {len(policies)} policies into Pinecone...")

    if OpenAI is None or Pinecone is None:
        print("⚠️  openai or pinecone client libraries are not installed. Skipping embedding/upsert steps.")
        for policy in policies:
            print(f"   ✓ {policy.get('id')}: {policy.get('title')}")
        return

    # Initialize clients
    openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
    index = pc.Index(os.getenv('PINECONE_INDEX_NAME', 'bethesda'))

    # Process each policy
    vectors = []
    for policy in policies:
        policy_id = policy.get('id')
        category = policy.get('category')
        title = policy.get('title')
        content = (policy.get('content') or '').strip()

        text = f"{title}\n\n{content}"

        # Generate embedding
        response = openai_client.embeddings.create(
            model="text-embedding-3-large",
            input=text,
        )
        embedding = response.data[0].embedding

        vectors.append({
            "id": policy_id,
            "values": embedding,
            "metadata": {
                "category": category,
                "title": title,
                "content": content,
            }
        })
        print(f"   ✓ {policy_id}: {title}")

    # Upsert to Pinecone
    index.upsert(vectors=vectors)

    # Verify
    stats = index.describe_index_stats()
    print(f"\n✅ Done! {stats.total_vector_count} policies loaded into Pinecone")


if __name__ == '__main__':
    main()

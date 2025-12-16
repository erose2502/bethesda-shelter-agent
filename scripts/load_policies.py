"""Script to load shelter policies into Pinecone."""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import yaml
from dotenv import load_dotenv
from openai import OpenAI
from pinecone import Pinecone

# Load environment
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# Initialize clients
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
index = pc.Index(os.getenv('PINECONE_INDEX_NAME', 'bethesda'))

# Load policies from YAML
policies_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data/policies/sample_policies.yaml')
with open(policies_path, 'r') as f:
    data = yaml.safe_load(f)

policies = data['policies']
print(f"📄 Loading {len(policies)} policies into Pinecone...")

# Process each policy
vectors = []
for policy in policies:
    policy_id = policy['id']
    category = policy['category']
    title = policy['title']
    content = policy['content'].strip()
    
    # Create text for embedding
    text = f"{title}\n\n{content}"
    
    # Generate embedding (text-embedding-3-large with 1024 dimensions)
    response = openai_client.embeddings.create(
        model="text-embedding-3-large",
        input=text,
        dimensions=1024
    )
    embedding = response.data[0].embedding
    
    vectors.append({
        "id": policy_id,
        "values": embedding,
        "metadata": {
            "category": category,
            "title": title,
            "content": content
        }
    })
    print(f"   ✓ {policy_id}: {title}")

# Upsert to Pinecone
index.upsert(vectors=vectors)

# Verify
stats = index.describe_index_stats()
print(f"\n✅ Done! {stats.total_vector_count} policies loaded into Pinecone")

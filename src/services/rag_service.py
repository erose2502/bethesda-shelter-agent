"""RAG Service - Bethesda-specific truth using ChromaDB (in-memory)."""

from typing import Optional
import os

from openai import AsyncOpenAI
import chromadb
from chromadb.config import Settings as ChromaSettings

from src.config import get_settings


class RAGService:
    """
    Retrieval-Augmented Generation for shelter policies using ChromaDB.
    
    Why RAG matters:
    - Without RAG, the AI will lie accidentally
    - With RAG, it answers only from approved policy
    
    What goes in:
    - Intake rules
    - Sobriety requirements  
    - Curfew times
    - Length-of-stay rules
    - Behavior expectations
    - Bed assignment logic
    
    Now using ChromaDB (in-memory) instead of Pinecone for simplicity.
    """

    def __init__(self):
        self.settings = get_settings()
        self.openai_client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self._chroma_client = None
        self._collection = None

    def _get_chroma_collection(self):
        """Get or create ChromaDB collection."""
        if self._collection is None:
            # Use persistent storage if path is set, otherwise in-memory
            if self.settings.chromadb_persist_path:
                self._chroma_client = chromadb.PersistentClient(
                    path=self.settings.chromadb_persist_path
                )
            else:
                self._chroma_client = chromadb.Client()
            
            # Get or create the policies collection
            self._collection = self._chroma_client.get_or_create_collection(
                name="shelter_policies",
                metadata={"description": "Bethesda Mission shelter policies"}
            )
            
            # Load default policies if collection is empty
            if self._collection.count() == 0:
                self._load_default_policies()
        
        return self._collection

    def _load_default_policies(self):
        """Load default shelter policies into ChromaDB."""
        default_policies = [
            {
                "id": "intake-hours",
                "category": "intake",
                "title": "Intake Hours",
                "content": "Our shelter is open 24/7 for intakes. You can come in at any time. Check-in typically starts at 5 PM and ends at 7 PM for evening shelter, but we accept emergency intakes around the clock."
            },
            {
                "id": "sobriety-policy",
                "category": "rules",
                "title": "Sobriety Requirement",
                "content": "We require sobriety at our shelter. No alcohol or drugs are allowed on the premises. You must be sober to enter and stay. If you're struggling with addiction, we can connect you with resources to help, including detox programs and recovery services."
            },
            {
                "id": "curfew",
                "category": "rules",
                "title": "Curfew Times",
                "content": "Our curfew is at 9 PM. You need to be checked in and on the premises by then. If you arrive after curfew, you may not be able to stay that night unless it's an emergency situation."
            },
            {
                "id": "length-of-stay",
                "category": "rules",
                "title": "Length of Stay",
                "content": "Maximum stay is 30 days. We provide night-by-night emergency shelter. For longer-term housing assistance, our staff can discuss options with you including transitional housing programs."
            },
            {
                "id": "what-to-bring",
                "category": "intake",
                "title": "What to Bring",
                "content": "You should bring a valid ID if you have one, but it's not required for emergency shelter. We provide bedding, towels, and basic toiletries. You can bring personal items, but space is limited. Secure storage is available for valuables."
            },
            {
                "id": "meals",
                "category": "services",
                "title": "Meals Provided",
                "content": "Free meals are provided. We serve dinner in the evening and breakfast in the morning. Special dietary needs can be accommodated when possible - just let staff know."
            },
            {
                "id": "address",
                "category": "location",
                "title": "Shelter Location",
                "content": "Bethesda Mission Men's Shelter is located at 611 Reily Street, Harrisburg, PA. We are open 24/7 for intakes."
            },
            {
                "id": "bed-capacity",
                "category": "capacity",
                "title": "Bed Capacity",
                "content": "We have 108 beds total. Beds are assigned on a first-come, first-served basis. Reservations are held for 3 hours - if you don't arrive within that time, the reservation expires and the bed becomes available to others."
            },
        ]
        
        # Add policies to collection
        self._collection.add(
            ids=[p["id"] for p in default_policies],
            documents=[f"{p['title']}\n\n{p['content']}" for p in default_policies],
            metadatas=[{"category": p["category"], "title": p["title"], "content": p["content"]} for p in default_policies]
        )
        print(f"✅ Loaded {len(default_policies)} default policies into ChromaDB")

    async def query(self, question: str, top_k: int = 3) -> Optional[str]:
        """
        Query RAG for relevant shelter policy information.
        
        Args:
            question: The caller's question
            top_k: Number of relevant chunks to retrieve
            
        Returns:
            Generated response based on retrieved context, or None if no relevant info
        """
        try:
            collection = self._get_chroma_collection()
            
            # Query ChromaDB (uses default embedding function)
            results = collection.query(
                query_texts=[question],
                n_results=top_k,
            )

            # Extract context from results
            if not results["documents"] or not results["documents"][0]:
                return None

            documents = results["documents"][0]
            distances = results["distances"][0] if results.get("distances") else [0] * len(documents)
            
            # Filter by similarity (lower distance = more similar in ChromaDB)
            context_parts = []
            for doc, distance in zip(documents, distances):
                if distance < 1.5:  # ChromaDB uses L2 distance by default
                    context_parts.append(doc)

            if not context_parts:
                return self._get_fallback_response(question)

            context = "\n\n".join(context_parts)

            # Generate response using context
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful assistant for Bethesda Mission Men's Shelter. "
                            "Answer the question based ONLY on the provided context. "
                            "If the context doesn't contain the answer, say you don't have that information "
                            "and offer to connect them with staff. "
                            "Be warm, compassionate, and concise. "
                            "Speak as if talking to someone on the phone."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {question}",
                    },
                ],
                temperature=0.3,
                max_tokens=200,
            )

            return response.choices[0].message.content

        except Exception as e:
            print(f"RAG query error: {e}")
            return self._get_fallback_response(question)
            print(f"RAG query error: {e}")
            return self._get_fallback_response(question)

    def _get_fallback_response(self, question: str) -> Optional[str]:
        """Provide fallback responses for common questions when RAG is unavailable."""
        question_lower = question.lower()

        # Curfew questions
        if "curfew" in question_lower or "what time" in question_lower:
            return (
                "Our curfew is at 9 PM. You need to be checked in and on the premises by then. "
                "Check-in starts at 5 PM and ends at 7 PM."
            )

        # Sobriety questions
        if "sober" in question_lower or "alcohol" in question_lower or "drug" in question_lower:
            return (
                "We require sobriety at our shelter. No alcohol or drugs are allowed on the premises. "
                "If you're struggling with addiction, we can connect you with resources to help."
            )

        # What to bring
        if "bring" in question_lower or "need" in question_lower:
            return (
                "You should bring a valid ID if you have one, but it's not required. "
                "We provide bedding, towels, and basic toiletries. "
                "You can bring personal items, but space is limited."
            )

        # Length of stay
        if "how long" in question_lower or "stay" in question_lower:
            return (
                "Our emergency shelter provides night-by-night stays up to 30 days maximum. "
                "For longer-term housing assistance, our staff can discuss options with you."
            )

        return None

    async def add_policy(
        self,
        policy_id: str,
        category: str,
        title: str,
        content: str,
    ) -> bool:
        """
        Add or update a policy document in the vector database.
        
        This should be called when policies are created/updated.
        """
        try:
            collection = self._get_chroma_collection()
            
            # Upsert to ChromaDB
            collection.upsert(
                ids=[policy_id],
                documents=[f"{title}\n\n{content}"],
                metadatas=[{
                    "category": category,
                    "title": title,
                    "content": content,
                }]
            )
            return True

        except Exception as e:
            print(f"Error adding policy to RAG: {e}")
            return False

    async def delete_policy(self, policy_id: str) -> bool:
        """Delete a policy from the vector database."""
        try:
            collection = self._get_chroma_collection()
            collection.delete(ids=[policy_id])
            return True
        except Exception as e:
            print(f"Error deleting policy from RAG: {e}")
            return False

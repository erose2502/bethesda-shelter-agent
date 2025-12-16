"""RAG Service - Bethesda-specific truth from Pinecone."""

from typing import Optional

from openai import AsyncOpenAI

from src.config import get_settings


class RAGService:
    """
    Retrieval-Augmented Generation for shelter policies.
    
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
    """

    def __init__(self):
        self.settings = get_settings()
        self.openai_client = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self._pinecone_index = None

    async def _get_pinecone_index(self):
        """Lazy-load Pinecone index."""
        if self._pinecone_index is None:
            try:
                from pinecone import Pinecone
                
                pc = Pinecone(api_key=self.settings.pinecone_api_key)
                self._pinecone_index = pc.Index(self.settings.pinecone_index_name)
            except Exception as e:
                print(f"Pinecone initialization error: {e}")
                return None
        return self._pinecone_index

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
            # 1. Generate embedding for the question
            embedding_response = await self.openai_client.embeddings.create(
                model="text-embedding-3-large",
                input=question,
                dimensions=1024,
            )
            query_embedding = embedding_response.data[0].embedding

            # 2. Query Pinecone for similar documents
            index = await self._get_pinecone_index()
            if index is None:
                # Fallback to default policies if Pinecone unavailable
                return self._get_fallback_response(question)

            results = index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
            )

            # 3. Extract context from results
            if not results.matches:
                return None

            context_parts = []
            for match in results.matches:
                if match.score > 0.35:  # Lower threshold for text-embedding-3-large
                    metadata = match.metadata or {}
                    content = metadata.get("content", "")
                    if content:
                        context_parts.append(content)

            if not context_parts:
                return None

            context = "\n\n".join(context_parts)

            # 4. Generate response using context
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",  # Cost-effective for RAG responses
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
                "Our emergency shelter provides night-by-night stays. "
                "You check in each evening and leave in the morning. "
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
        
        This should be called when policies are created/updated in the database.
        """
        try:
            # Generate embedding
            embedding_response = await self.openai_client.embeddings.create(
                model="text-embedding-3-large",
                input=f"{title}\n\n{content}",
                dimensions=1024,
            )
            embedding = embedding_response.data[0].embedding

            # Upsert to Pinecone
            index = await self._get_pinecone_index()
            if index is None:
                return False

            index.upsert(
                vectors=[
                    {
                        "id": policy_id,
                        "values": embedding,
                        "metadata": {
                            "category": category,
                            "title": title,
                            "content": content,
                        },
                    }
                ]
            )
            return True

        except Exception as e:
            print(f"Error adding policy to RAG: {e}")
            return False

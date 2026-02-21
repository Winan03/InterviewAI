"""
Test rápido de la integración completa con Hugging Face
"""
import asyncio
import httpx


import os

async def test():
    hf_token = os.environ.get("HF_API_TOKEN", "")
    model = "google/gemma-3-12b-it:featherless-ai"
    base_url = os.environ.get("HF_API_URL", "https://router.huggingface.co/v1")
    
    print("🤗 Test Final - Hugging Face + Gemma 3 12B")
    print("=" * 50)
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {hf_token}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": "Responde en español: ¿Qué es FastAPI y para qué sirve?"
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 200,
                "stream": False
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Status: {response.status_code}")
            print(f"📦 Modelo: {model}")
            print(f"\n💬 Respuesta:")
            print("-" * 50)
            print(result["choices"][0]["message"]["content"])
            print("-" * 50)
            if "usage" in result:
                usage = result["usage"]
                print(f"\n📈 Tokens: prompt={usage.get('prompt_tokens', 'N/A')}, completion={usage.get('completion_tokens', 'N/A')}")
            print("\n🎉 ¡Todo funciona correctamente!")
        else:
            print(f"❌ Error {response.status_code}: {response.text[:300]}")


if __name__ == "__main__":
    asyncio.run(test())

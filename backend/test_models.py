"""
Script para probar múltiples modelos y proveedores en HF Inference API
"""
import asyncio
import httpx
import json
import os


async def test_model(hf_token: str, model: str, base_url: str):
    """Prueba un modelo específico"""
    print(f"\n📦 Probando modelo: {model}")
    
    try:
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
                            "content": "Responde en español en una sola oración: ¿Qué es FastAPI?"
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 100,
                    "stream": False
                }
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result["choices"][0]["message"]["content"]
                print(f"   ✅ Respuesta: {ai_response[:150]}...")
                return True
            else:
                error_text = response.text[:200]
                print(f"   ❌ Error: {error_text}")
                return False
                
    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return False


async def main():
    hf_token = os.environ.get("HF_API_TOKEN", "")
    base_url = "https://router.huggingface.co/v1"
    
    # List of models to try (from HF recommended + providers)
    models = [
        "google/gemma-3-12b-it:hf-inference",
        "google/gemma-3-12b-it:featherless-ai",
        "google/gemma-3-4b-it",
        "google/gemma-3-4b-it:hf-inference",
        "Qwen/Qwen2.5-7B-Instruct",
        "Qwen/Qwen3-4B-Thinking-2507",
        "mistralai/Mistral-7B-Instruct-v0.3",
        "meta-llama/Llama-3.1-8B-Instruct",
    ]
    
    print("=" * 60)
    print("  VozInterview - Búsqueda de Modelo Compatible")
    print("=" * 60)
    print(f"🔑 Token: {hf_token[:15]}...")
    print(f"🌐 URL: {base_url}")
    
    working_models = []
    
    for model in models:
        success = await test_model(hf_token, model, base_url)
        if success:
            working_models.append(model)
        await asyncio.sleep(1)  # Rate limit safety
    
    print("\n" + "=" * 60)
    print("📊 RESULTADOS")
    print("=" * 60)
    
    if working_models:
        print(f"\n✅ Modelos que funcionan ({len(working_models)}):")
        for m in working_models:
            print(f"   🟢 {m}")
        print(f"\n👉 Modelo recomendado: {working_models[0]}")
    else:
        print("\n❌ Ningún modelo funcionó.")
        print("👉 Posibles causas:")
        print("   - Token sin permisos suficientes")
        print("   - Ningún proveedor de inferencia habilitado")
    print()


if __name__ == "__main__":
    asyncio.run(main())

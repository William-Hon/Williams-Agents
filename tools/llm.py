import os
import json
import re
import logging
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger(__name__)

DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:latest")


class LLMClient:
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = (base_url or DEFAULT_OLLAMA_URL).rstrip("/")
        self.model = model or DEFAULT_MODEL

    def is_available(self) -> bool:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=1.5)
            return r.status_code == 200
        except Exception:
            return False

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """Query local Ollama instance. Falls back cleanly if Ollama is not running."""
        if not self.is_available():
            logger.warning("Local Ollama not reachable at %s. Using heuristic fallback.", self.base_url)
            return ""

        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt or "",
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    return res.json().get("response", "").strip()
                logger.error("Ollama API error: %s", res.text)
                return ""
        except Exception as e:
            logger.error("Failed to query Ollama: %s", str(e))
            return ""

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Ask LLM for JSON and parse output safely."""
        full_system = (system_prompt or "") + "\nRespond strictly in valid JSON format."
        text = self.generate(prompt, system_prompt=full_system, temperature=0.1)
        if not text:
            return None

        # Extract JSON substring
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        try:
            return json.loads(text)
        except Exception:
            return None


default_llm = LLMClient()


import os
import django
from pathlib import Path
from dotenv import load_dotenv
from google import genai

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "saferoute.settings")
django.setup()

from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

models = [
    settings.GEMINI_PRIMARY_MODEL,
    settings.GEMINI_BACKUP_MODEL,
]

print("\nTesting Gemini models...\n")

for model in models:
    try:
        print(f"Testing: {model}")

        response = client.models.generate_content(
            model=model,
            contents=(
                "You are a road damage inspection assistant. "
                "Reply with exactly: Road damage AI test successful."
            ),
        )

        print("SUCCESS:", response.text)
        break

    except Exception as error:
        print("FAILED:", str(error))
        print("Trying the next model...\n")
else:
    print("Both Gemini models failed.")

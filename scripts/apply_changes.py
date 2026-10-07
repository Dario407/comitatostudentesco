import os
import google.generativeai as genai

# Configura le API di Gemini
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

issue_title = os.environ.get("ISSUE_TITLE", "")
issue_body = os.environ.get("ISSUE_BODY", "")

prompt = f"""
Sei un assistente di programmazione. L'utente ha chiesto le seguenti modifiche al progetto:

Titolo Issue: {issue_title}
Descrizione: {issue_body}

Analizza la richiesta ed esegui le modifiche necessarie modificando o creando i file nel repository.
"""

model = genai.GenerativeModel("gemini-1.5-pro")
response = model.generate_content(prompt)

print("Risposta da Gemini ricevuta.")

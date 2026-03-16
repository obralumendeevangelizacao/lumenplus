FROM python:3.11-slim

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements e instala
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia código
COPY . .

# Torna o script de start executável
RUN chmod +x /app/start.sh

# Expõe porta (Railway injeta PORT automaticamente)
EXPOSE 8000

# Produção: roda migrations e sobe o servidor
CMD ["/app/start.sh"]

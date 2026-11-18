FROM mcr.microsoft.com/playwright/python:v1.48.0-noble

# Install ffmpeg, fonts (Poppins, Noto Sans CJK, DejaVu), and system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-noto-cjk \
    fonts-dejavu-core \
    fontconfig \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install local Google Poppins font for exact Latin typography match
RUN mkdir -p /usr/share/fonts/truetype/poppins && \
    curl -fsSL -o /usr/share/fonts/truetype/poppins/Poppins-Regular.ttf https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf && \
    curl -fsSL -o /usr/share/fonts/truetype/poppins/Poppins-Bold.ttf https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf && \
    fc-cache -f -v

WORKDIR /app

# Copy service dependencies and source code
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Ensure playwright browsers are installed and linked
RUN playwright install chromium

COPY . /app

EXPOSE 5050
ENV RENDER_PORT=5050
ENV PYTHONUNBUFFERED=1

CMD ["python3", "server.py"]

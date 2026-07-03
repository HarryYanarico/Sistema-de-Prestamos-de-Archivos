# --- ETAPA DE COMPILACIÓN ---
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código del frontend
COPY . .

# Argumento para pasar la URI de la API en tiempo de compilación
ARG VITE_GRAPHQL_URI
ENV VITE_GRAPHQL_URI=$VITE_GRAPHQL_URI

# Compilar para producción
RUN npm run build

# --- ETAPA DE PRODUCCIÓN (NGINX) ---
FROM nginx:1.25-alpine

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos compilados del constructor al directorio de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

## 🐳 Docker Frontend

### Frontend

To run the frontend locally via Docker you can use the included Dockerfile like this:

```bash
cd frontend
docker build --no-cache -t exulu-frontend .
docker run --env-file .env -p 3000:3000 exulu-frontend
```
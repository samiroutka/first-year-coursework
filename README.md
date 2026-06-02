# Умная парковка

Курсовой проект: симуляция работы парковки для легковых и грузовых автомобилей.

## Запуск FastAPI

Из корня проекта:

```powershell
pip install -r requirements.txt
uvicorn main:app --reload
```

Если ты уже находишься в папке `api`, запускай так:

```powershell
uvicorn app:app --reload
```

Сервер будет доступен на `http://127.0.0.1:8000`.

## Структура API

- `api/app.py` создает FastAPI-приложение;
- `api/routes.py` содержит API-эндпоинты;
- `api/parking.py` хранит состояние и логику симуляции;
- `api/models.py` содержит модели входных данных.

## Запуск React

```powershell
cd react
npm install
npm run dev
```

Frontend обращается к FastAPI по адресу `http://127.0.0.1:8000`.

## CSV

Файл расписания должен иметь поля:

```csv
type,arrival,hours
car,1,3
truck,2,5
```

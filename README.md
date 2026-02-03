# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Nomadtable MVP (карта + ивенты + чат)

### Карта 2ГИС
- Вкладка **Карта** показывает 2ГИС Бишкек внутри приложения через `WebView`.

### Ивенты + чат (сейчас локально для 1 пользователя)
Сейчас ивенты и сообщения **сохраняются локально** (AsyncStorage) — удобно, пока мы не сделали выбор точки на карте и не включили “мультипользовательский” режим.

### Ивенты + чат (видно другим пользователям) — позже
Когда будем готовы, подключим бэкенд. В проект уже добавлен **Supabase** (самый быстрый MVP).

#### 1) Supabase: создать таблицы
- Создай проект в Supabase
- Открой **SQL Editor** и выполни `supabase/schema.sql`
- Открой **Project Settings → API** и скопируй:
  - `Project URL`
  - `anon public key`

#### 2) Expo env
Создай файл `.env` в корне проекта:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Перезапусти dev-сервер после изменения `.env`.

#### Что уже сделано в приложении
- Вкладка **Ивенты**: список ивентов из Supabase + кнопка **Создать**
- Экран **деталей ивента**: чат с временем сообщений + realtime обновления

> Важно: для Supabase-MVP в `schema.sql` разрешены insert/select всем (anon). Для продакшена нужно добавить auth и нормальные RLS правила.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

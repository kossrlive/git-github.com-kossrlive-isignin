# Requirements Document

## Introduction

Shopify App для аутентификации клиентов магазина, которое позволяет входить в личный кабинет и подтверждать заказы используя номер телефона через SMS (провайдер sms.to), email/пароль, или Google OAuth. Приложение создается с использованием Shopify CLI (@shopify/app), автоматически создает customer аккаунты в Shopify для новых пользователей и использует Multipass для безопасной аутентификации. Приложение будет развернуто через Shopify Dev Dashboard.

## Glossary

- **Shopify App**: Приложение созданное с помощью Shopify CLI и зарегистрированное в Dev Dashboard
- **Auth Service**: Backend компонент приложения, который обрабатывает аутентификацию пользователей
- **OTP (One-Time Password)**: Одноразовый код для подтверждения по SMS
- **Multipass**: Механизм Shopify Plus для создания безопасных сессий клиентов
- **Customer**: Пользователь в системе Shopify
- **SMS Provider**: Внешний сервис для отправки SMS (основной: sms.to, с возможностью добавления резервных провайдеров)
- **SMS Provider Interface**: Единый интерфейс для всех SMS провайдеров, обеспечивающий взаимозаменяемость
- **Fallback Mechanism**: Механизм автоматического переключения на резервный провайдер при сбое основного
- **OAuth Provider**: Сервис социальной аутентификации (Google, Apple, Facebook и др.)
- **OAuth Provider Interface**: Единый интерфейс для всех OAuth провайдеров, обеспечивающий расширяемость
- **Session Persistence**: Механизм сохранения данных сессии в localStorage или cookies для автоматического восстановления
- **Checkout Interception**: Перехват события перехода к checkout для проверки аутентификации
- **Shopify Admin API**: API для управления данными магазина
- **Shopify CLI**: Инструмент командной строки для разработки Shopify приложений
- **App Extension**: Расширение приложения для интеграции UI в Shopify storefront
- **Redis**: In-memory хранилище для временных данных (OTP коды)
- **DLR (Delivery Receipt)**: Подтверждение доставки SMS сообщения
- **Webhook**: HTTP callback для получения событий от Shopify или sms.to

## Requirements

### Requirement 1

**User Story:** Как пользователь магазина, я хочу войти в систему используя свой номер телефона и SMS код, чтобы быстро получить доступ к личному кабинету без необходимости запоминать пароль.

#### Acceptance Criteria

1. WHEN пользователь вводит номер телефона и запрашивает OTP, THEN THE Auth Service SHALL валидировать формат номера телефона
2. WHEN номер телефона валиден, THEN THE Auth Service SHALL генерировать 6-значный OTP код и сохранять его в Redis с TTL 5 минут
3. WHEN OTP код сгенерирован, THEN THE Auth Service SHALL отправлять SMS через sms.to провайдера с OTP кодом
4. WHEN пользователь вводит OTP код, THEN THE Auth Service SHALL проверять код против сохраненного значения в Redis
5. WHEN OTP код корректен и не истек, THEN THE Auth Service SHALL искать или создавать Customer в Shopify используя Admin API

### Requirement 2

**User Story:** Как пользователь магазина, я хочу войти в систему используя email и пароль, чтобы иметь традиционный способ аутентификации.

#### Acceptance Criteria

1. WHEN пользователь вводит email и пароль, THEN THE Auth Service SHALL валидировать формат email
2. WHEN credentials валидны, THEN THE Auth Service SHALL проверять существование Customer в Shopify через Admin API
3. WHEN Customer существует, THEN THE Auth Service SHALL верифицировать пароль используя безопасное хеширование (bcrypt)
4. WHEN Customer не существует и это первый вход, THEN THE Auth Service SHALL создавать нового Customer в Shopify с хешированным паролем
5. WHEN аутентификация успешна, THEN THE Auth Service SHALL генерировать Multipass token для создания сессии

### Requirement 3

**User Story:** Как пользователь магазина, я хочу войти через Google аккаунт, чтобы использовать существующую аутентификацию без создания нового пароля.

#### Acceptance Criteria

1. WHEN пользователь нажимает кнопку "Войти через Google", THEN THE Auth Service SHALL инициировать OAuth 2.0 flow с Google
2. WHEN Google возвращает authorization code, THEN THE Auth Service SHALL обменивать код на access token
3. WHEN access token получен, THEN THE Auth Service SHALL запрашивать профиль пользователя (email, имя) из Google API
4. WHEN профиль получен, THEN THE Auth Service SHALL искать Customer в Shopify по email
5. WHEN Customer не найден, THEN THE Auth Service SHALL автоматически создавать нового Customer в Shopify с данными из Google профиля

### Requirement 4

**User Story:** Как система, я должна создавать безопасные сессии для аутентифицированных пользователей, чтобы они могли получить доступ к защищенным ресурсам Shopify.

#### Acceptance Criteria

1. WHEN пользователь успешно аутентифицирован любым методом, THEN THE Auth Service SHALL генерировать Multipass token используя Shopify Multipass secret
2. WHEN Multipass token создан, THEN THE Auth Service SHALL включать в него customer email, created_at timestamp, и return_to URL
3. WHEN Multipass token сгенерирован, THEN THE Auth Service SHALL возвращать redirect URL к Shopify с Multipass token
4. WHEN клиент переходит по Multipass URL, THEN Shopify SHALL автоматически создавать сессию для Customer
5. WHEN сессия создана, THEN Shopify SHALL перенаправлять пользователя на указанный return_to URL

### Requirement 5

**User Story:** Как администратор системы, я хочу отслеживать доставку SMS сообщений, чтобы обеспечить надежность системы аутентификации.

#### Acceptance Criteria

1. WHEN SMS отправлено через sms.to, THEN THE Auth Service SHALL сохранять message ID и статус в базе данных
2. WHEN sms.to отправляет DLR webhook, THEN THE Auth Service SHALL обновлять статус доставки сообщения
3. WHEN SMS не доставлено в течение 2 минут, THEN THE Auth Service SHALL логировать ошибку для мониторинга
4. WHEN пользователь запрашивает повторную отправку OTP, THEN THE Auth Service SHALL проверять, что прошло минимум 30 секунд с последней отправки
5. WHEN количество попыток отправки превышает 3 за 10 минут для одного номера, THEN THE Auth Service SHALL блокировать дальнейшие запросы на 10 минут

### Requirement 6

**User Story:** Как администратор системы, я хочу защитить систему от злоупотреблений, чтобы предотвратить spam и brute-force атаки.

#### Acceptance Criteria

1. WHEN пользователь вводит неверный OTP код, THEN THE Auth Service SHALL увеличивать счетчик неудачных попыток для данного номера телефона
2. WHEN количество неудачных попыток достигает 5, THEN THE Auth Service SHALL блокировать номер телефона на 15 минут
3. WHEN обнаружена подозрительная активность (более 10 запросов в минуту с одного IP), THEN THE Auth Service SHALL применять rate limiting
4. WHEN OTP код используется успешно, THEN THE Auth Service SHALL немедленно удалять его из Redis
5. WHEN истекает TTL для OTP кода в Redis, THEN Redis SHALL автоматически удалять запись

### Requirement 7

**User Story:** Как разработчик, я хочу иметь надежную обработку ошибок и логирование, чтобы быстро диагностировать и решать проблемы.

#### Acceptance Criteria

1. WHEN происходит ошибка при вызове Shopify Admin API, THEN THE Auth Service SHALL логировать детали ошибки и возвращать понятное сообщение клиенту
2. WHEN происходит ошибка при отправке SMS, THEN THE Auth Service SHALL логировать ошибку и возвращать generic сообщение без раскрытия внутренних деталей
3. WHEN происходит ошибка валидации данных, THEN THE Auth Service SHALL возвращать конкретные сообщения о том, какие поля невалидны
4. WHEN происходит критическая ошибка, THEN THE Auth Service SHALL отправлять alert в систему мониторинга
5. WHEN запрос обрабатывается, THEN THE Auth Service SHALL логировать request ID, метод аутентификации, и время обработки

### Requirement 8

**User Story:** Как пользователь магазина, я хочу подтверждать свои заказы по SMS, чтобы обеспечить безопасность транзакций.

#### Acceptance Criteria

1. WHEN создается заказ требующий подтверждения, THEN THE Auth Service SHALL генерировать уникальный OTP код для заказа
2. WHEN OTP для заказа генерируется, THEN THE Auth Service SHALL отправлять SMS с кодом и номером заказа на телефон Customer
3. WHEN пользователь вводит OTP для подтверждения заказа, THEN THE Auth Service SHALL проверять соответствие кода и order ID
4. WHEN OTP для заказа корректен, THEN THE Auth Service SHALL обновлять статус заказа в Shopify через Admin API
5. WHEN OTP для заказа истекает (10 минут), THEN THE Auth Service SHALL автоматически отменять неподтвержденный заказ

### Requirement 9

**User Story:** Как система, я должна безопасно хранить конфиденциальные данные, чтобы защитить информацию пользователей.

#### Acceptance Criteria

1. WHEN система запускается, THEN THE Auth Service SHALL загружать Shopify API credentials и Multipass secret из переменных окружения
2. WHEN система запускается, THEN THE Auth Service SHALL загружать sms.to API credentials из переменных окружения
3. WHEN пароли сохраняются, THEN THE Auth Service SHALL хешировать их используя bcrypt с cost factor минимум 12
4. WHEN OTP коды сохраняются в Redis, THEN THE Auth Service SHALL использовать secure connection (TLS)
5. WHEN данные передаются между клиентом и сервером, THEN THE Auth Service SHALL требовать HTTPS для всех endpoints

### Requirement 10

**User Story:** Как разработчик, я хочу иметь очередь для обработки SMS сообщений, чтобы обеспечить надежную доставку при высокой нагрузке.

#### Acceptance Criteria

1. WHEN запрос на отправку SMS получен, THEN THE Auth Service SHALL добавлять задачу в Bull queue
2. WHEN задача добавлена в очередь, THEN THE Auth Service SHALL немедленно возвращать response клиенту
3. WHEN worker обрабатывает задачу из очереди, THEN THE Auth Service SHALL выполнять HTTP запрос к sms.to API
4. WHEN отправка SMS не удалась, THEN THE Auth Service SHALL повторять попытку до 3 раз с exponential backoff
5. WHEN все попытки исчерпаны, THEN THE Auth Service SHALL перемещать задачу в failed queue для ручной обработки

### Requirement 11

**User Story:** Как разработчик, я хочу создать приложение используя Shopify CLI и современную архитектуру, чтобы обеспечить совместимость и простоту развертывания.

#### Acceptance Criteria

1. WHEN приложение инициализируется, THEN THE Shopify App SHALL создаваться используя команду `npm init @shopify/app@latest`
2. WHEN приложение настраивается, THEN THE Shopify App SHALL регистрироваться в Dev Dashboard с необходимыми scopes (read_customers, write_customers, read_orders, write_orders)
3. WHEN приложение разрабатывается локально, THEN THE Shopify App SHALL использовать Shopify CLI для тестирования с командой `npm run dev`
4. WHEN приложение требует UI на storefront, THEN THE Shopify App SHALL создавать App Extension для формы входа
5. WHEN приложение получает запросы, THEN THE Shopify App SHALL валидировать HMAC подпись от Shopify для безопасности

### Requirement 12

**User Story:** Как владелец магазина, я хочу настраивать внешний вид формы входа, чтобы она соответствовала дизайну моего магазина.

#### Acceptance Criteria

1. WHEN владелец магазина открывает настройки приложения, THEN THE Shopify App SHALL отображать admin UI для кастомизации
2. WHEN владелец магазина изменяет цвета формы, THEN THE Shopify App SHALL сохранять настройки в metafields магазина
3. WHEN форма входа отображается на storefront, THEN THE App Extension SHALL применять сохраненные настройки стилей
4. WHEN владелец магазина включает/выключает методы аутентификации, THEN THE Shopify App SHALL обновлять доступные опции на форме входа
5. WHEN настройки изменяются, THEN THE Shopify App SHALL немедленно применять изменения без необходимости перезагрузки

### Requirement 13

**User Story:** Как администратор системы, я хочу иметь гибкую систему SMS провайдеров с возможностью fallback, чтобы обеспечить высокую надежность доставки сообщений.

#### Acceptance Criteria

1. WHEN система инициализируется, THEN THE Auth Service SHALL загружать конфигурацию SMS провайдеров с приоритетами из настроек
2. WHEN отправка SMS через основной провайдер (sms.to) не удалась, THEN THE Auth Service SHALL автоматически переключаться на резервный провайдер
3. WHEN пользователь запрашивает повторную отправку OTP, THEN THE Auth Service SHALL использовать следующий провайдер из списка для отправки
4. WHEN добавляется новый SMS провайдер, THEN THE Auth Service SHALL поддерживать единый интерфейс (interface/abstract class) для всех провайдеров
5. WHEN провайдер возвращает ошибку, THEN THE Auth Service SHALL логировать детали ошибки с указанием имени провайдера для диагностики

### Requirement 14

**User Story:** Как разработчик, я хочу иметь расширяемую архитектуру для OAuth провайдеров, чтобы легко добавлять новые методы социальной аутентификации в будущем.

#### Acceptance Criteria

1. WHEN система проектируется, THEN THE Auth Service SHALL использовать единый интерфейс (interface/abstract class) для всех OAuth провайдеров
2. WHEN реализуется Google OAuth, THEN THE Auth Service SHALL создавать базовую реализацию, которая может быть расширена для других провайдеров
3. WHEN добавляется новый OAuth провайдер (Apple, Facebook), THEN THE Auth Service SHALL требовать только реализацию методов интерфейса без изменения core логики
4. WHEN OAuth провайдер возвращает user profile, THEN THE Auth Service SHALL нормализовать данные в единый формат независимо от провайдера
5. WHEN владелец магазина настраивает приложение, THEN THE Shopify App SHALL позволять включать/выключать каждый OAuth провайдер независимо

### Requirement 15

**User Story:** Как пользователь магазина, я хочу автоматически проходить аутентификацию при переходе к checkout, чтобы не терять товары в корзине и быстро завершить покупку.

#### Acceptance Criteria

1. WHEN пользователь нажимает кнопку "Перейти к checkout" и не аутентифицирован, THEN THE App Extension SHALL перехватывать событие и отображать форму входа
2. WHEN форма входа отображается, THEN THE App Extension SHALL проверять наличие сохраненных данных в localStorage или cookies
3. WHEN найдены валидные данные сессии в localStorage или cookies, THEN THE Auth Service SHALL автоматически восстанавливать сессию через Multipass
4. WHEN данные сессии отсутствуют или невалидны, THEN THE App Extension SHALL отображать форму входа с опциями SMS, email, или OAuth
5. WHEN пользователь успешно аутентифицируется, THEN THE Auth Service SHALL перенаправлять пользователя к checkout с сохраненной корзиной

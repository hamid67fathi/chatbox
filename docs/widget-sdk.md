# Widget SDK — `cbx()`

پس از بارگذاری اسکریپت ویجت، متد سراسری `cbx` در دسترس است.

## شناسایی مخاطب

```js
cbx('identify', {
  email: 'user@example.com',
  name: 'علی',
  phone: '+989121234567',
});
```

## ردیابی رویداد سفارشی

```js
cbx('track', 'purchase', {
  amount: 500000,
  currency: 'IRR',
});
```

رویدادها از طریق `POST /v1/track` در Visitor Event Store ذخیره می‌شوند.

## صف قبل از آماده‌شدن ویجت

```html
<script>
  window.cbx = window.cbx || function () {
    (window.cbx.q = window.cbx.q || []).push(arguments);
  };
  cbx('track', 'page_ready');
</script>
```

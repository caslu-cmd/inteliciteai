# Modelos de e-mail em português — Intelicite

Cole cada bloco em **Supabase → Authentication → Emails → Templates**.
Para cada tipo, há dois campos: **Subject** (assunto) e **Message body** (o HTML).
As variáveis entre `{{ }}` são preenchidas automaticamente pelo Supabase — não mude.

---

## 1. Confirmar cadastro (Confirm signup)

**Subject:**
```
Confirme seu cadastro no Intelicite
```

**Message body:**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececf1;">
    <div style="padding:28px 32px 8px;">
      <p style="font-size:18px;font-weight:700;color:#111;margin:0;">Intelicite</p>
    </div>
    <div style="padding:8px 32px 24px;color:#333;line-height:1.6;font-size:15px;">
      <h1 style="font-size:20px;color:#111;margin:12px 0;">Bem-vindo(a)! 🎉</h1>
      <p>Falta só um passo para ativar sua conta no Intelicite. Confirme seu e-mail clicando no botão abaixo:</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="background:#6d28d9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;display:inline-block;">Confirmar meu e-mail</a>
      </p>
      <p style="font-size:13px;color:#777;">Se o botão não funcionar, copie e cole este link no navegador:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#6d28d9;word-break:break-all;">{{ .ConfirmationURL }}</a>
      </p>
      <p style="font-size:13px;color:#777;">Se você não criou esta conta, pode ignorar este e-mail.</p>
    </div>
    <div style="padding:16px 32px;background:#faf9fd;color:#999;font-size:12px;border-top:1px solid #ececf1;">
      Intelicite — inteligência para licitações públicas (Lei 14.133/2021).
    </div>
  </div>
</div>
```

---

## 2. Redefinir senha (Reset Password)

**Subject:**
```
Redefinição de senha — Intelicite
```

**Message body:**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececf1;">
    <div style="padding:28px 32px 8px;">
      <p style="font-size:18px;font-weight:700;color:#111;margin:0;">Intelicite</p>
    </div>
    <div style="padding:8px 32px 24px;color:#333;line-height:1.6;font-size:15px;">
      <h1 style="font-size:20px;color:#111;margin:12px 0;">Redefinir sua senha</h1>
      <p>Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="background:#6d28d9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;display:inline-block;">Criar nova senha</a>
      </p>
      <p style="font-size:13px;color:#777;">Se o botão não funcionar, copie e cole este link:<br>
        <a href="{{ .ConfirmationURL }}" style="color:#6d28d9;word-break:break-all;">{{ .ConfirmationURL }}</a>
      </p>
      <p style="font-size:13px;color:#777;">Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.</p>
    </div>
    <div style="padding:16px 32px;background:#faf9fd;color:#999;font-size:12px;border-top:1px solid #ececf1;">
      Intelicite — inteligência para licitações públicas (Lei 14.133/2021).
    </div>
  </div>
</div>
```

---

## 3. Link mágico (Magic Link)

**Subject:**
```
Seu link de acesso ao Intelicite
```

**Message body:**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececf1;">
    <div style="padding:28px 32px 8px;">
      <p style="font-size:18px;font-weight:700;color:#111;margin:0;">Intelicite</p>
    </div>
    <div style="padding:8px 32px 24px;color:#333;line-height:1.6;font-size:15px;">
      <h1 style="font-size:20px;color:#111;margin:12px 0;">Entrar no Intelicite</h1>
      <p>Use o botão abaixo para acessar sua conta com segurança:</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="background:#6d28d9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;display:inline-block;">Entrar agora</a>
      </p>
      <p style="font-size:13px;color:#777;">Se você não solicitou este acesso, pode ignorar este e-mail.</p>
    </div>
    <div style="padding:16px 32px;background:#faf9fd;color:#999;font-size:12px;border-top:1px solid #ececf1;">
      Intelicite — inteligência para licitações públicas (Lei 14.133/2021).
    </div>
  </div>
</div>
```

---

## 4. Convite (Invite user)

**Subject:**
```
Você foi convidado(a) para o Intelicite
```

**Message body:**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececf1;">
    <div style="padding:28px 32px 8px;">
      <p style="font-size:18px;font-weight:700;color:#111;margin:0;">Intelicite</p>
    </div>
    <div style="padding:8px 32px 24px;color:#333;line-height:1.6;font-size:15px;">
      <h1 style="font-size:20px;color:#111;margin:12px 0;">Você recebeu um convite 🎉</h1>
      <p>Você foi convidado(a) para usar o Intelicite. Clique abaixo para aceitar o convite e criar sua senha:</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="background:#6d28d9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;display:inline-block;">Aceitar convite</a>
      </p>
    </div>
    <div style="padding:16px 32px;background:#faf9fd;color:#999;font-size:12px;border-top:1px solid #ececf1;">
      Intelicite — inteligência para licitações públicas (Lei 14.133/2021).
    </div>
  </div>
</div>
```

---

## 5. Alteração de e-mail (Change Email Address)

**Subject:**
```
Confirme a alteração do seu e-mail — Intelicite
```

**Message body:**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececf1;">
    <div style="padding:28px 32px 8px;">
      <p style="font-size:18px;font-weight:700;color:#111;margin:0;">Intelicite</p>
    </div>
    <div style="padding:8px 32px 24px;color:#333;line-height:1.6;font-size:15px;">
      <h1 style="font-size:20px;color:#111;margin:12px 0;">Confirmar novo e-mail</h1>
      <p>Recebemos um pedido para alterar o e-mail da sua conta para <strong>{{ .NewEmail }}</strong>. Confirme clicando abaixo:</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="{{ .ConfirmationURL }}" style="background:#6d28d9;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;display:inline-block;">Confirmar alteração</a>
      </p>
      <p style="font-size:13px;color:#777;">Se você não pediu esta alteração, ignore este e-mail.</p>
    </div>
    <div style="padding:16px 32px;background:#faf9fd;color:#999;font-size:12px;border-top:1px solid #ececf1;">
      Intelicite — inteligência para licitações públicas (Lei 14.133/2021).
    </div>
  </div>
</div>
```

---

## 6. Reautenticação / código (Reauthentication)

**Subject:**
```
Seu código de verificação — Intelicite
```

**Message body:**
```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f7;padding:32px 0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #ececf1;">
    <div style="padding:28px 32px 8px;">
      <p style="font-size:18px;font-weight:700;color:#111;margin:0;">Intelicite</p>
    </div>
    <div style="padding:8px 32px 24px;color:#333;line-height:1.6;font-size:15px;">
      <h1 style="font-size:20px;color:#111;margin:12px 0;">Código de verificação</h1>
      <p>Use o código abaixo para confirmar sua identidade:</p>
      <p style="text-align:center;margin:24px 0;">
        <span style="font-size:30px;font-weight:700;letter-spacing:6px;color:#111;background:#f3f0fb;padding:14px 22px;border-radius:8px;display:inline-block;">{{ .Token }}</span>
      </p>
      <p style="font-size:13px;color:#777;">Se você não solicitou este código, ignore este e-mail.</p>
    </div>
    <div style="padding:16px 32px;background:#faf9fd;color:#999;font-size:12px;border-top:1px solid #ececf1;">
      Intelicite — inteligência para licitações públicas (Lei 14.133/2021).
    </div>
  </div>
</div>
```

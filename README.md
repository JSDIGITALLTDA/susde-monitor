# sUSDe Term Structure Monitor

Dashboard para monitorar a curva de juros implícita do sUSDe no Pendle Finance.

---

## 🚀 INSTRUÇÕES DE DEPLOY (Passo a Passo)

### Pré-requisitos
- Uma conta no GitHub (grátis): https://github.com
- Uma conta na Vercel (grátis): https://vercel.com

---

## MÉTODO 1: Via GitHub (Recomendado)

### Passo 1: Criar conta no GitHub
1. Vá em https://github.com
2. Clique em "Sign up"
3. Siga as instruções para criar sua conta

### Passo 2: Criar um novo repositório
1. Depois de logado, clique no botão "+" no canto superior direito
2. Clique em "New repository"
3. Nome: `susde-monitor`
4. Deixe como "Public"
5. Clique em "Create repository"

### Passo 3: Fazer upload dos arquivos
1. Na página do repositório vazio, clique em "uploading an existing file"
2. Arraste TODA a pasta `susde-monitor` para a área de upload
3. Clique em "Commit changes"

### Passo 4: Conectar com Vercel
1. Vá em https://vercel.com
2. Clique em "Sign Up" e escolha "Continue with GitHub"
3. Autorize a Vercel a acessar seu GitHub
4. Clique em "Add New..." → "Project"
5. Encontre o repositório `susde-monitor` e clique em "Import"
6. Deixe todas as configurações padrão
7. Clique em "Deploy"

### Passo 5: Pronto! 🎉
- Aguarde 1-2 minutos
- A Vercel vai te dar um link tipo: `susde-monitor.vercel.app`
- Seu dashboard está no ar!

---

## MÉTODO 2: Via Vercel CLI (Mais Técnico)

Se você tem Node.js instalado:

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Entrar na pasta do projeto
cd susde-monitor

# 3. Instalar dependências
npm install

# 4. Deploy
vercel

# Siga as instruções na tela
```

---

## 📁 Estrutura do Projeto

```
susde-monitor/
├── package.json          # Configurações do projeto
├── public/
│   └── index.html        # HTML base
└── src/
    ├── index.js          # Entrada do React
    └── App.js            # Dashboard principal
```

---

## ❓ Problemas Comuns

### "Build failed"
- Verifique se todos os arquivos foram enviados
- O arquivo `package.json` deve estar na raiz

### "Cannot find module"
- A Vercel instala as dependências automaticamente
- Se persistir, tente fazer o deploy novamente

### Dashboard não carrega dados
- A API do Pendle pode estar temporariamente fora
- Clique em "Atualizar" no dashboard
- Verifique o console do navegador (F12)

---

## 🔄 Atualizações Futuras

Para atualizar o site depois de fazer mudanças:
1. Faça as alterações nos arquivos
2. No GitHub, vá no seu repositório
3. Clique em "Add file" → "Upload files"
4. Faça upload dos arquivos modificados
5. A Vercel atualiza automaticamente em 1-2 minutos

---

## 📊 Funcionalidades

- ✅ Dados em tempo real da API do Pendle
- ✅ Cálculo automático do Term Spread
- ✅ Identificação de regime (Contango/Backwardation)
- ✅ Sinal de trading baseado em pesquisa BlockTower
- ✅ Auto-refresh a cada 5 minutos
- ✅ Tabela com todos os mercados sUSDe

---

## 📝 Notas

- Os dados históricos são simulados (a API não fornece histórico)
- A análise de retorno é baseada em pesquisa da BlockTower
- Use como ferramenta auxiliar, não como conselho de investimento

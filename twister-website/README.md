# @twister.srv - Website & Editorial

Website profissional para a marca **@twister.srv** - Creative Studio & Audiovisual Production.

## 🎨 Visão Geral

Este é um website moderno e responsivo desenvolvido para um estúdio criativo especializado em produção audiovisual, direção de arte e conteúdo editorial.

## ✨ Funcionalidades

- **Design Moderno**: Interface escura com gradientes vibrantes e animações suaves
- **Totalmente Responsivo**: Funciona perfeitamente em desktop, tablet e mobile
- **Seções Incluídas**:
  - Home com hero section impactante
  - Sobre (About) com estatísticas animadas
  - Galeria Editorial com grid moderno
  - Showcase Audiovisual com player de vídeo
  - Serviços com cards interativos
  - Formulário de Contato funcional
  - Footer com links sociais

- **Animações**:
  - Scroll suave entre seções
  - Animação de entrada com Intersection Observer
  - Efeito parallax no hero
  - Counter animation nas estatísticas
  - Hover effects em todos os elementos interativos
  - Twister animation (logo animado)

## 📁 Estrutura de Arquivos

```
twister-website/
├── index.html      # Estrutura HTML principal
├── styles.css      # Estilização completa
├── script.js       # JavaScript para interatividade
└── README.md       # Este arquivo
```

## 🚀 Como Usar

### Opção 1: Abrir Localmente
Simplesmente abra o arquivo `index.html` em seu navegador.

### Opção 2: Servidor Local (Recomendado)
```bash
cd twister-website
python3 -m http.server 8080
```
Acesse: `http://localhost:8080`

### Opção 3: Deploy
Faça upload dos arquivos para qualquer hospedagem estática:
- Netlify
- Vercel
- GitHub Pages
- Cloudflare Pages

## 🎯 Personalização

### Cores
Edite as variáveis CSS em `styles.css`:
```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    --accent-color: #f5576c;
    --dark-bg: #0a0a0a;
    --card-bg: #121212;
}
```

### Conteúdo
- Edite os textos diretamente no `index.html`
- Substitua os gradientes das galerias por imagens reais
- Adicione seus vídeos na seção de audiovisual
- Atualize informações de contato e redes sociais

### Imagens e Vídeos
Para adicionar suas próprias mídias:

1. **Galeria Editorial**: Substitua as `div.gallery-placeholder` por tags `img`:
```html
<div class="gallery-item">
    <img src="caminho/da/sua/imagem.jpg" alt="Descrição">
    <div class="overlay">
        <h3>Título do Projeto</h3>
        <p>Descrição</p>
    </div>
</div>
```

2. **Player de Vídeo**: Integre com YouTube, Vimeo ou HTML5 video:
```html
<video controls>
    <source src="seu-video.mp4" type="video/mp4">
</video>
```

## 📱 Responsividade

O website é totalmente responsivo com breakpoints em:
- **Desktop**: > 968px
- **Tablet**: 768px - 968px
- **Mobile**: < 768px
- **Mobile Pequeno**: < 480px

## 🔧 Tecnologias Utilizadas

- **HTML5**: Estrutura semântica
- **CSS3**: Estilização com variáveis, Grid, Flexbox
- **JavaScript Vanilla**: Interatividade sem dependências
- **Google Fonts**: Space Grotesk

## 📞 Contato

Para personalizações ou dúvidas sobre o projeto.

---

**@twister.srv** © 2024 - Creative Studio & Audiovisual Production

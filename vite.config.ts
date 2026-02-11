import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';

    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        strictPort: true,
      },
      plugins: [tailwindcss(), react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'es2022',
        minify: 'esbuild',
        sourcemap: !isProd,
        cssCodeSplit: true,
        rollupOptions: {
          output: {
            manualChunks(id) {
              // Vendor chunks
              if (id.includes('node_modules')) {
                if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
                if (id.includes('@google/genai')) return 'vendor-genai';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('zustand') || id.includes('swr') || id.includes('jszip')) return 'vendor-utils';
                return; // let vite handle other node_modules
              }

              // Services
              if (id.includes('/services/geminiService') || id.includes('/services/geminiServiceWithFallback') || id.includes('/services/modelFallback')) return 'services-ai';
              if (id.includes('/services/storage/') || id.includes('/services/ossService')) return 'services-storage';
              if (id.includes('/services/soraProviders/') || id.includes('/services/soraService') || id.includes('/services/soraConfigService') || id.includes('/services/soraModelConfig') || id.includes('/services/soraPromptBuilder')) return 'services-sora';
              if (id.includes('/services/characterActionHandler') || id.includes('/services/characterGenerationManager')) return 'services-character';
              if (id.includes('/services/modelConfig') || id.includes('/services/modelConfigManager') || id.includes('/services/modelConfigLoader') || id.includes('/services/promptManager')) return 'services-config';
              if (id.includes('/services/videoPlatforms/') || id.includes('/services/videoGenerationService')) return 'services-video-platforms';
              if (id.includes('/services/nodes/')) return 'services-nodes';
              if (id.includes('/services/apiInterceptor/')) return 'services-interceptor';

              // Handlers
              if (id.includes('/handlers/useNodeActions')) return 'services-node-handlers';

              // Editor components (lazy-loaded)
              if (id.includes('/components/VideoEditor') || id.includes('/components/StoryboardVideoNode') || id.includes('/components/StoryboardEditor') || id.includes('/components/StoryboardTimeline')) return 'editor-video';
              if (id.includes('/components/ImageCropper') || id.includes('/components/SketchEditor')) return 'editor-image';
              if (id.includes('/components/SonicStudio')) return 'editor-audio';
              if (id.includes('/components/CharacterLibrary') || id.includes('/components/CharacterDetailModal')) return 'editor-character';

              // Panel components
              if (id.includes('/components/SettingsPanel') || id.includes('/components/SettingsModal') || id.includes('/components/ModelConfigPanel') || id.includes('/components/StorageSettingsPanel') || id.includes('/components/DebugPanel')) return 'panels-settings';
              if (id.includes('/components/SmartSequenceDock') || id.includes('/components/AssistantPanel') || id.includes('/components/ChatWindow') || id.includes('/components/SidebarDock') || id.includes('/components/Galaxy')) return 'panels-ui';
            },
          },
        },
        chunkSizeWarningLimit: 600,
      },
      esbuild: {
        drop: isProd ? ['console', 'debugger'] : [],
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'zustand', 'swr', 'lucide-react'],
      },
    };
});

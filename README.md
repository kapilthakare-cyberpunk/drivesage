# 🚀 DriveSage

**Smart Google Drive Organization Tool** - Privacy-first file management with AI-powered organization

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue.svg)](https://github.com/drivesage/drivesage)
[![Electron](https://img.shields.io/badge/Electron-28.0.0-blue.svg)](https://electronjs.org/)

## ✨ Features

- 🔍 **Smart Drive Analysis** - Comprehensive scanning of your Google Drive with detailed insights
- 📁 **Intelligent Organization** - AI-powered file categorization and folder structure optimization
- 🔄 **Duplicate Detection** - Find and manage duplicate files to save storage space
- 🛡️ **Safety First** - Dry-run mode and protected file detection to prevent accidental deletions
- 🎨 **Modern UI** - Beautiful, responsive interface with dark mode support
- 🔒 **Privacy Focused** - All processing happens locally, no data sent to external servers
- ⚡ **Cross-Platform** - Works on macOS, Windows, and Linux

## 🖼️ Screenshots

![DriveSage Dashboard](assets/screenshots/dashboard.png)
*Smart dashboard with drive statistics and quick actions*

![File Analysis](assets/screenshots/analysis.png)
*Detailed file analysis with categorization and recommendations*

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- Google Drive folder access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/drivesage/drivesage.git
   cd drivesage
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

### Development Mode

For development with hot reloading and DevTools:

```bash
npm run dev
```

## 📖 Usage

### 1. Select Your Drive
- Choose your Google Drive folder path
- The app will scan and analyze your files

### 2. Review Analysis
- View file statistics and folder structure
- Identify large files and system files
- Check for potential duplicates

### 3. Organize Files
- Use dry-run mode to preview changes
- Let AI suggest optimal folder structure
- Safely move and organize files

### 4. Clean Up
- Remove duplicate files
- Delete system files (.DS_Store, Thumbs.db)
- Optimize storage usage

## 🛠️ Development

### Project Structure

```
drivesage/
├── main.js              # Main Electron process
├── renderer.js          # Frontend logic
├── index.html           # Main UI
├── styles.css           # Styling
├── package.json         # Dependencies and scripts
├── assets/              # Icons and images
└── README.md           # This file
```

### Available Scripts

- `npm start` - Launch the application
- `npm run dev` - Development mode with DevTools
- `npm run build` - Build for all platforms
- `npm run build:mac` - Build for macOS
- `npm run build:win` - Build for Windows
- `npm run build:linux` - Build for Linux
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run clean` - Clean build artifacts

### Building for Distribution

```bash
# Build for your current platform
npm run build

# Build for specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

## 🔧 Configuration

### Settings

DriveSage includes several configurable options:

- **Dry Run Mode**: Preview changes before applying them
- **Auto Backup**: Automatically create backups before operations
- **Protected Patterns**: Customize which files are considered protected
- **Theme**: Light/dark mode support

### Protected Files

By default, DriveSage protects files containing:
- `gemini`
- `ai`
- `assistant`
- `code`
- `project`

You can customize these patterns in the settings.

## 🛡️ Safety Features

- **Dry Run Mode**: Preview all operations before executing
- **Protected File Detection**: Automatically identifies important files
- **Backup Creation**: Optional automatic backups before operations
- **Error Handling**: Comprehensive error reporting and recovery
- **Logging**: Detailed operation logs for troubleshooting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://electronjs.org/)
- Icons from [Feather Icons](https://feathericons.com/)
- Inspired by the need for better file organization

## 📞 Support

- 📧 Email: hello@drivesage.app
- 🐛 Issues: [GitHub Issues](https://github.com/drivesage/drivesage/issues)
- 📖 Documentation: [Wiki](https://github.com/drivesage/drivesage/wiki)

## 🗺️ Roadmap

- [ ] Google Drive API integration
- [ ] Cloud sync capabilities
- [ ] Advanced duplicate detection algorithms
- [ ] Batch operations
- [ ] Custom organization rules
- [ ] Performance optimizations
- [ ] Mobile companion app

---

**Made with ❤️ for better file organization** 
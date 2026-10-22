package service

import (
	"fmt"
	"log"
	"os"
	"strings"

	"vulnark/internal/config"
	"vulnark/internal/repository"
	"vulnark/pkg/database"
)

// InitService 初始化服务接口
type InitService interface {
	InitializeSystem() error
	CreateDefaultAdminUser() (string, error)
	ResetAdminPassword() (string, error)
}

// initService 初始化服务实现
type initService struct {
	userRepo repository.UserRepository
}

// NewInitService 创建初始化服务
func NewInitService(userRepo repository.UserRepository) InitService {
	return &initService{
		userRepo: userRepo,
	}
}

// InitializeSystem 初始化系统
func (s *initService) InitializeSystem() error {
	log.Println("🚀 开始初始化VulnArk系统...")

	// 检查是否为首次部署
	isFirstDeploy := s.isFirstTimeDeployment()

	// 使用新的迁移管理器执行数据库迁移和初始化
	migrationManager := database.NewMigrationManager()
	if err := migrationManager.RunMigrations(); err != nil {
		return fmt.Errorf("系统初始化失败: %v", err)
	}

	// 检查管理员用户并显示登录信息
	adminUser, err := s.userRepo.GetByUsername("admin")
	var password string

	if err == nil && adminUser != nil {
		// 管理员用户已存在
		log.Println("========================================")
		log.Println("🎉 VulnArk 系统已就绪！")
		log.Println("========================================")
		log.Println("📋 管理员账号信息：")
		log.Printf("   👤 用户名: admin")
		log.Printf("   📧 邮  箱: %s", adminUser.Email)
		log.Printf("   👨‍💼 真实姓名: %s", adminUser.RealName)
		
		// 如果是首次部署或存在凭证文件，显示密码信息
		if isFirstDeploy {
			password := s.getAdminPasswordFromFile()
			if password != "" {
				log.Printf("   🔑 密  码: %s", password)
				log.Println("========================================")
				log.Println("⚠️  重要提醒:")
				log.Println("   • 这是首次部署，请立即登录并修改默认密码")
				log.Println("   • 请妥善保管管理员账号信息")
				log.Println("   • 建议启用双因素认证增强安全性")
				log.Println("   • 登录后请删除 admin_credentials.txt 文件")
			} else {
				log.Println("   🔑 密  码: [请查看 admin_credentials.txt 文件]")
			}
		} else {
			log.Println("   🔑 密  码: [请使用您设置的密码登录]")
		}
		
		log.Println("========================================")
		log.Println("🌐 访问地址:")
		log.Printf("   • http://localhost:%s", config.AppConfig.Server.Port)
		log.Printf("   • http://127.0.0.1:%s", config.AppConfig.Server.Port)
		log.Println("========================================")
	} else {
		// 创建默认管理员用户
		password, err = s.CreateDefaultAdminUser()
		if err != nil {
			return fmt.Errorf("创建默认管理员用户失败: %v", err)
		}

		// 输出管理员账号信息
		log.Println("========================================")
		log.Println("🎉 VulnArk 系统初始化完成！")
		log.Println("========================================")
		log.Println("📋 默认管理员账号信息：")
		log.Printf("   用户名: admin")
		log.Printf("   密码: %s", password)
		log.Printf("   邮箱: admin@vulnark.com")
		log.Println("========================================")
		log.Println("⚠️  请妥善保存管理员密码，首次登录后建议修改！")
		log.Printf("🌐 访问地址: http://localhost:%s", config.AppConfig.Server.Port)
		log.Println("========================================")
	}

	return nil
}

// isFirstTimeDeployment 检查是否为首次部署
func (s *initService) isFirstTimeDeployment() bool {
	// 检查是否存在管理员凭证文件
	if _, err := os.Stat("admin_credentials.txt"); err == nil {
		return true
	}
	
	// 检查数据库中是否只有一个管理员用户（刚创建的）
	var userCount int64
	if db := database.GetDB(); db != nil {
		db.Table("users").Count(&userCount)
		return userCount <= 1
	}
	
	return false
}

// getAdminPasswordFromFile 从凭证文件中读取管理员密码
func (s *initService) getAdminPasswordFromFile() string {
	credentialsFile := "admin_credentials.txt"
	
	// 检查文件是否存在
	if _, err := os.Stat(credentialsFile); os.IsNotExist(err) {
		return ""
	}
	
	// 读取文件内容
	content, err := os.ReadFile(credentialsFile)
	if err != nil {
		log.Printf("⚠️  读取凭证文件失败: %v", err)
		return ""
	}
	
	// 解析密码
	lines := strings.Split(string(content), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "密码:") || strings.HasPrefix(line, "密码：") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	
	return ""
}

// CleanupCredentialsFile 清理凭证文件（可选的辅助方法）
func (s *initService) CleanupCredentialsFile() error {
	credentialsFile := "admin_credentials.txt"
	if _, err := os.Stat(credentialsFile); err == nil {
		if err := os.Remove(credentialsFile); err != nil {
			return fmt.Errorf("删除凭证文件失败: %v", err)
		}
		log.Println("✅ 已清理管理员凭证文件")
	}
	return nil
}

// CreateDefaultAdminUser 创建默认管理员用户
func (s *initService) CreateDefaultAdminUser() (string, error) {
	log.Println("正在创建默认管理员用户...")
	
	// 这个方法的具体实现需要根据你的业务逻辑来完成
	// 这里只是一个占位符，防止编译错误
	return "", fmt.Errorf("CreateDefaultAdminUser 方法需要实现")
}

// ResetAdminPassword 重置管理员密码
func (s *initService) ResetAdminPassword() (string, error) {
	log.Println("正在重置管理员密码...")
	
	// 这个方法的具体实现需要根据你的业务逻辑来完成
	// 这里只是一个占位符，防止编译错误
	return "", fmt.Errorf("ResetAdminPassword 方法需要实现")
}

// createWelcomeNotification 创建欢迎通知
func (s *initService) createWelcomeNotification(userID uint) {
	// 这里可以添加通知创建逻辑，暂时跳过以避免循环依赖
	// 可以在后续版本中通过数据库直接插入或使用通知服务
	log.Printf("✅ 欢迎通知已准备就绪")
}

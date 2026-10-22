package main

// VulnArk 演示数据导入器
//
// 用法（必须在项目根目录执行）：
//   go run ./cmd/seed            # 导入演示数据（已有数据则跳过）
//   go run ./cmd/seed --force    # 清空资产与漏洞后重新导入
//   go run ./cmd/seed --file seed/demo-data.json
//
// 说明：直接写数据库（不走 HTTP API），速度快且能保留漏洞状态与时间分布。

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"vulnark/internal/config"
	"vulnark/internal/model"
	"vulnark/pkg/database"
	"vulnark/pkg/utils"
)

type seedUser struct {
	ID         uint   `json:"id"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	RealName   string `json:"real_name"`
	Phone      string `json:"phone"`
	Department string `json:"department"`
	RoleID     uint   `json:"role_id"`
	Password   string `json:"password"`
}

type seedAsset struct {
	ID              uint   `json:"id"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	Category        string `json:"category"`
	IPAddress       string `json:"ip_address"`
	Domain          string `json:"domain"`
	Port            string `json:"port"`
	OS              string `json:"os"`
	Version         string `json:"version"`
	Department      string `json:"department"`
	BusinessLine    string `json:"business_line"`
	ImportanceLevel int    `json:"importance_level"`
	Description     string `json:"description"`
	Status          int    `json:"status"`
	OwnerID         *uint  `json:"owner_id"`
	Company         string `json:"company"`
	SystemName      string `json:"system_name"`
	Environment     string `json:"environment"`
	Fingerprint     string `json:"fingerprint"`
	Services        string `json:"services"`
	Middleware      string `json:"middleware"`
	Framework       string `json:"framework"`
}

type seedVuln struct {
	ID                uint    `json:"id"`
	Title             string  `json:"title"`
	VulnType          string  `json:"vuln_type"`
	IntelID           string  `json:"intel_id"`
	Description       string  `json:"description"`
	CVEID             string  `json:"cve_id"`
	CNVDID            string  `json:"cnvd_id"`
	OWASPCategoryID   *uint   `json:"owasp_category_id"`
	SeverityLevel     int     `json:"severity_level"`
	CVSSScore         *float64 `json:"cvss_score"`
	AssetID           uint    `json:"asset_id"`
	AssigneeID        *uint   `json:"assignee_id"`
	Status            string  `json:"status"`
	ImpactScope       string  `json:"impact_scope"`
	ReproductionSteps string  `json:"reproduction_steps"`
	FixSuggestion     string  `json:"fix_suggestion"`
	Source            string  `json:"source"`
	Fingerprint       string  `json:"fingerprint"`
	DiscoveredAt      string  `json:"discovered_at"`
	AssignedAt        string  `json:"assigned_at"`
	FixedAt           string  `json:"fixed_at"`
	VerifiedAt        string  `json:"verified_at"`
	ClosedAt          string  `json:"closed_at"`
}

type seedOWASP struct {
	ID   uint   `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
	Year int    `json:"year"`
}

type seedData struct {
	Company string      `json:"company"`
	OWASP   []seedOWASP `json:"owasp"`
	Users   []seedUser  `json:"users"`
	Assets  []seedAsset `json:"assets"`
	Vulns   []seedVuln  `json:"vulns"`
}

func parseTime(s string) *time.Time {
	if s == "" {
		return nil
	}
	layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02"}
	for _, f := range layouts {
		if t, err := time.Parse(f, s); err == nil {
			return &t
		}
	}
	return nil
}

// findProjectRoot 向上查找包含 configs/config.yaml 的目录，兼容从任意子目录运行
func findProjectRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for i := 0; i < 6; i++ {
		if _, e := os.Stat(filepath.Join(dir, "configs", "config.yaml")); e == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}

func main() {
	force := flag.Bool("force", false, "清空现有资产与漏洞后重新导入")
	file := flag.String("file", "seed/demo-data.json", "种子数据文件路径")
	flag.Parse()

	// 自动切到项目根目录（configs/ 与 seed/ 都是相对路径）
	if root := findProjectRoot(); root != "" {
		if cur, _ := os.Getwd(); cur != root {
			if err := os.Chdir(root); err != nil {
				log.Fatalf("切换到项目根目录失败: %v", err)
			}
			log.Printf("📂 已自动定位项目根目录: %s", root)
		}
	} else {
		log.Println("⚠️  未找到 configs/config.yaml，将在当前目录读取配置")
	}

	config.LoadConfig()
	database.InitDatabase()
	defer database.CloseDatabase()
	db := database.DB

	// 首次在空库上直接跑 seed 时，先把所有表建出来
	if err := database.NewMigrationManager().RunMigrations(); err != nil {
		log.Printf("⚠️  迁移告警: %v", err)
	}
	// 新增展示字段（指纹 / 环境 / 漏洞类型等）需要补列
	log.Println("🔧 同步表结构（新增展示字段）...")
	if err := db.AutoMigrate(&model.Asset{}, &model.Vulnerability{}); err != nil {
		// GORM 遍历时会尝试删除不存在的旧约束（如 uni_roles_name），与迁移管理器一致，忽略此类预期错误
		if strings.Contains(err.Error(), "Can't DROP") && strings.Contains(err.Error(), "check that column/key exists") {
			log.Printf("⚠️  忽略预期的约束错误: %v", err)
		} else {
			log.Fatalf("表结构同步失败: %v", err)
		}
	}

	raw, err := os.ReadFile(*file)
	if err != nil {
		log.Fatalf("读取种子数据失败: %v（请在项目根目录执行）", err)
	}
	var data seedData
	if err := json.Unmarshal(raw, &data); err != nil {
		log.Fatalf("解析种子数据失败: %v", err)
	}
	log.Printf("📦 种子数据: %d 人 / %d 资产 / %d 漏洞", len(data.Users), len(data.Assets), len(data.Vulns))

	// ---- 是否已有数据 ----
	var assetCount int64
	db.Model(&model.Asset{}).Count(&assetCount)
	if assetCount > 0 && !*force {
		log.Printf("⚠️  库中已有 %d 条资产，跳过导入。如需重置请加 --force", assetCount)
		return
	}
	if *force {
		log.Println("🧹 清空现有漏洞与资产...")
		db.Exec("DELETE FROM vulnerability_attachments")
		db.Exec("DELETE FROM vulnerabilities")
		db.Exec("DELETE FROM assets")
	}

	// ---- OWASP 分类 ----
	owaspMap := map[uint]uint{}
	for _, o := range data.OWASP {
		var exist model.OWASPCategory
		if err := db.Where("code = ?", o.Code).First(&exist).Error; err == nil {
			owaspMap[o.ID] = exist.ID
			continue
		}
		cat := model.OWASPCategory{Code: o.Code, Name: o.Name, Year: 2021, SeverityLevel: 3}
		if err := db.Create(&cat).Error; err == nil {
			owaspMap[o.ID] = cat.ID
		}
	}
	log.Printf("✅ OWASP 分类: %d 条", len(owaspMap))

	// ---- 用户（跳过已存在的 admin 及同名账号）----
	userMap := map[uint]uint{}
	var adminID uint
	var admin model.User
	if err := db.Where("username = ?", "admin").First(&admin).Error; err == nil {
		adminID = admin.ID
	}
	pwdHash, err := utils.HashPassword("VulnArk@2026")
	if err != nil {
		log.Fatalf("密码加密失败: %v", err)
	}
	created := 0
	for _, u := range data.Users {
		var exist model.User
		if err := db.Where("username = ?", u.Username).First(&exist).Error; err == nil {
			userMap[u.ID] = exist.ID
			continue
		}
		roleID := u.RoleID
		var role model.Role
		if err := db.Where("id = ?", roleID).First(&role).Error; err != nil {
			if err := db.Where("name = ?", "开发工程师").First(&role).Error; err == nil {
				roleID = role.ID
			} else {
				roleID = 1
			}
		}
		nu := model.User{
			Username:     u.Username,
			Email:        u.Email,
			PasswordHash: pwdHash,
			RealName:     u.RealName,
			Phone:        u.Phone,
			RoleID:       roleID,
			Department:   u.Department,
			Status:       1,
		}
		if err := db.Create(&nu).Error; err == nil {
			userMap[u.ID] = nu.ID
			created++
		}
	}
	log.Printf("✅ 用户: 新建 %d 个（统一初始密码 VulnArk@2026）", created)

	// ---- 资产 ----
	assetMap := map[uint]uint{}
	now := time.Now()
	batch := make([]model.Asset, 0, 50)
	flushAssets := func() {
		if len(batch) == 0 {
			return
		}
		if err := db.CreateInBatches(batch, 50).Error; err != nil {
			log.Printf("⚠️  资产批次写入失败: %v", err)
		}
		batch = batch[:0]
	}
	for _, a := range data.Assets {
		ownerID := (*uint)(nil)
		if a.OwnerID != nil {
			if rid, ok := userMap[*a.OwnerID]; ok {
				id := rid
				ownerID = &id
			}
		}
		importance := a.ImportanceLevel
		if importance < 1 || importance > 3 {
			importance = 3
		}
		batch = append(batch, model.Asset{
			CreatedAt: now, UpdatedAt: now,
			Name: a.Name, Type: a.Type, Category: a.Category,
			IPAddress: a.IPAddress, Domain: a.Domain, Port: a.Port,
			OS: a.OS, Version: a.Version, Department: a.Department,
			OwnerID: ownerID, BusinessLine: a.BusinessLine,
			ImportanceLevel: importance, Description: a.Description,
			Status:     a.Status,
			Company:    a.Company,
			SystemName: a.SystemName,
			Environment: a.Environment,
			Fingerprint: a.Fingerprint,
			Services:   a.Services,
			Middleware: a.Middleware,
			Framework:  a.Framework,
		})
		if len(batch) >= 50 {
			flushAssets()
		}
	}
	flushAssets()

	// 建立 名称 → 真实ID 映射
	var all []model.Asset
	db.Select("id", "name").Find(&all)
	nameToID := map[string]uint{}
	for _, a := range all {
		nameToID[a.Name] = a.ID
	}
	for _, a := range data.Assets {
		if rid, ok := nameToID[a.Name]; ok {
			assetMap[a.ID] = rid
		}
	}
	var assetTotal int64
	db.Model(&model.Asset{}).Count(&assetTotal)
	log.Printf("✅ 资产: 共 %d 条", assetTotal)

	// ---- 漏洞 ----
	vbatch := make([]model.Vulnerability, 0, 50)
	flushVulns := func() {
		if len(vbatch) == 0 {
			return
		}
		if err := db.CreateInBatches(vbatch, 50).Error; err != nil {
			log.Printf("⚠️  漏洞批次写入失败: %v", err)
		}
		vbatch = vbatch[:0]
	}
	discovered := parseTime(time.Now().Format(time.RFC3339))
	for _, v := range data.Vulns {
		assetID, ok := assetMap[v.AssetID]
		if !ok {
			continue
		}
		assigneeID := (*uint)(nil)
		if v.AssigneeID != nil {
			if rid, ok := userMap[*v.AssigneeID]; ok {
				id := rid
				assigneeID = &id
			}
		}
		owaspID := (*uint)(nil)
		if v.OWASPCategoryID != nil {
			if rid, ok := owaspMap[*v.OWASPCategoryID]; ok {
				id := rid
				owaspID = &id
			}
		}
		status := v.Status
		if status == "" {
			status = "new"
		}
		discAt := parseTime(v.DiscoveredAt)
		if discAt == nil {
			discAt = discovered
		}
		var discovererID *uint
		if adminID > 0 {
			id := adminID
			discovererID = &id
		}
		vbatch = append(vbatch, model.Vulnerability{
			CreatedAt: now, UpdatedAt: now,
			Title: v.Title, Description: v.Description,
			CVEID: v.CVEID, CNVDID: v.CNVDID,
			OWASPCategoryID:   owaspID,
			SeverityLevel:     v.SeverityLevel,
			CVSSScore:         v.CVSSScore,
			AssetID:           assetID,
			DiscovererID:      discovererID,
			AssigneeID:        assigneeID,
			Status:            status,
			ImpactScope:       v.ImpactScope,
			ReproductionSteps: v.ReproductionSteps,
			FixSuggestion:     v.FixSuggestion,
			DiscoveredAt:      *discAt,
			AssignedAt:        parseTime(v.AssignedAt),
			FixedAt:           parseTime(v.FixedAt),
			VerifiedAt:        parseTime(v.VerifiedAt),
			ClosedAt:          parseTime(v.ClosedAt),
			IntelID:           v.IntelID,
			VulnType:          v.VulnType,
			Source:            v.Source,
			Fingerprint:       v.Fingerprint,
		})
		if len(vbatch) >= 50 {
			flushVulns()
		}
	}
	flushVulns()

	var vulnTotal int64
	db.Model(&model.Vulnerability{}).Count(&vulnTotal)
	log.Printf("✅ 漏洞: 共 %d 条", vulnTotal)

	fmt.Println()
	fmt.Println("========================================")
	fmt.Println("🎉 演示数据导入完成！")
	fmt.Printf("   👥 人员 %d / 🖥  资产 %d / 🐛 漏洞 %d\n", len(userMap)+created, assetTotal, vulnTotal)
	fmt.Println("   演示账号初始密码: VulnArk@2026")
	fmt.Printf("   访问: http://localhost:%s\n", config.AppConfig.Server.Port)
	fmt.Println("========================================")
}

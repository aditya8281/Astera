use std::fs;
use std::path::Path;

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let workspace_root = Path::new(&manifest_dir)
        .parent()
        .expect("workspace root");
    let frontend_dist = workspace_root.join("apps").join("web").join("dist");
    let target = Path::new(&manifest_dir).join("frontend");

    if frontend_dist.exists() && frontend_dist.join("index.html").exists() {
        // Remove old frontend dir to avoid stale files
        if target.exists() {
            fs::remove_dir_all(&target).expect("remove old frontend dir");
        }
        copy_dir_all(&frontend_dist, &target).expect("copy frontend dist");
    } else {
        // Create placeholder
        fs::create_dir_all(&target).unwrap();
        fs::write(
            target.join("index.html"),
            "<html><body><h1>Astera</h1><p>Frontend not built. Run: cd apps/web && npm run build</p></body></html>",
        )
        .unwrap();
    }

    println!("cargo:rerun-if-changed=../../apps/web/dist/index.html");
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let target = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

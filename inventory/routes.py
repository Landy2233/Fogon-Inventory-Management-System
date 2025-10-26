from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from models import db, Product

inventory_bp = Blueprint("inventory", __name__)  # ← NAME = "inventory"

def manager_required():
    return current_user.is_authenticated and current_user.role == "manager"

@inventory_bp.route("/", methods=["GET"])
@login_required
def list_products():
    items = Product.query.order_by(Product.name).all()
    return render_template("products_list.html", items=items)

@inventory_bp.route("/add", methods=["GET","POST"])
@login_required
def add_product():
    if not manager_required():
        flash("Manager role required", "warning")
        return redirect(url_for("inventory.list_products"))
    if request.method == "POST":
        p = Product(
            name=request.form["name"].strip(),
            quantity=int(request.form.get("quantity",0)),
            price=request.form.get("price",0) or 0,
            description=request.form.get("description","").strip()
        )
        db.session.add(p); db.session.commit()
        flash("Product added", "success")
        return redirect(url_for("inventory.list_products"))
    return render_template("product_form.html", mode="add")

@inventory_bp.route("/edit/<int:pid>", methods=["GET","POST"])
@login_required
def edit_product(pid):
    if not manager_required():
        flash("Manager role required", "warning")
        return redirect(url_for("inventory.list_products"))
    p = Product.query.get_or_404(pid)
    if request.method == "POST":
        p.name = request.form["name"].strip()
        p.quantity = int(request.form.get("quantity",0))
        p.price = request.form.get("price",0) or 0
        p.description = request.form.get("description","").strip()
        db.session.commit()
        flash("Product updated", "success")
        return redirect(url_for("inventory.list_products"))
    return render_template("product_form.html", mode="edit", product=p)

@inventory_bp.route("/delete/<int:pid>", methods=["POST"])
@login_required
def delete_product(pid):
    if not manager_required():
        flash("Manager role required", "warning")
        return redirect(url_for("inventory.list_products"))
    p = Product.query.get_or_404(pid)
    db.session.delete(p); db.session.commit()
    flash("Product deleted", "success")
    return redirect(url_for("inventory.list_products"))

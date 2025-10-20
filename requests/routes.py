from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from models import db, Product, StockRequest

requests_bp = Blueprint("requests", __name__)  # ← NAME = "requests"

@requests_bp.route("/new", methods=["GET","POST"])
@login_required
def submit_request():
    products = Product.query.order_by(Product.name).all()
    if request.method == "POST":
        sr = StockRequest(
            product_id=int(request.form["product_id"]),
            requested_by=current_user.id,
            quantity=int(request.form["quantity"])
        )
        db.session.add(sr); db.session.commit()
        flash("Request submitted", "success")
        return redirect(url_for("inventory.list_products"))
    return render_template("request_form.html", products=products)

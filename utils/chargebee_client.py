import chargebee
from typing import Dict, Any, Optional


class ChargebeeClient:
    def __init__(self, site: Optional[str], api_key: Optional[str], enabled: bool = True):
        self.site = site
        self.api_key = api_key
        self.enabled = enabled
        
        if self.enabled and self.site and self.api_key:
            chargebee.configure(self.api_key, self.site)
    
    def create_subscription(self, extracted: Dict[str, Any]) -> Dict[str, Any]:
        """Create subscription in Chargebee (PC2 compatible)."""
        
        if not self.enabled:
            return {
                "skipped": True,
                "reason": "Chargebee is disabled"
            }
        
        if not self.site or not self.api_key:
            raise ValueError("Chargebee site and API key are required")
        
        # Step 1: Create customer
        customer_id = self._create_customer(extracted)
        
        # Step 2: Create subscription with items (PC2)
        subscription_result = self._create_subscription_with_items(customer_id, extracted)
        
        return subscription_result
    
    def _create_customer(self, extracted: Dict[str, Any]) -> str:
        """Create customer in Chargebee."""
        
        customer_name = extracted.get("customer_name") or "Demo Customer"
        email = extracted.get("customer_email")
        phone = extracted.get("customer_phone")
        
        payload = {
            "first_name": customer_name[:50],
        }
        
        if email:
            payload["email"] = email
        
        if phone:
            payload["phone"] = phone
        
        result = chargebee.Customer.create(payload)
        return result.customer.id
    
    def _get_item_price_id(self, plan_id: str, billing_period: str = "monthly") -> str:
        """
        Convert plan_id to item_price_id.
        Your pattern: cbdemo_business-suite -> cbdemo_business-suite-monthly
        """
        if not plan_id:
            raise ValueError("plan_id is required")
        
        # Based on your Chargebee: plan_id-monthly or plan_id-annual
        return f"{plan_id}-{billing_period.lower()}"
    
    def _create_subscription_with_items(
        self,
        customer_id: str,
        extracted: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create subscription using PC2 items API."""
        
        plan_id = extracted.get("plan_id")
        
        if not plan_id:
            raise ValueError("plan_id is required")
        
        # Determine billing period (default to monthly)
        term_months = extracted.get("term_months")
        billing_period = "annual" if term_months and term_months >= 12 else "monthly"
        
        # Generate item_price_id: cbdemo_business-suite-monthly
        item_price_id = self._get_item_price_id(plan_id, billing_period)
        
        payload = {
            "subscription_items": [
                {
                    "item_price_id": item_price_id,
                    "quantity": 1
                }
            ],
            "auto_collection": "off"
        }
        
        # Optional: add billing cycles for term
        if term_months:
            payload["billing_cycles"] = term_months
        
        try:
            # Create subscription
            result = chargebee.Subscription.create_with_items(customer_id, payload)
            
            subscription = result.subscription
            customer = result.customer
            
            return {
                "subscription_id": subscription.id if subscription else None,
                "status": subscription.status if subscription else None,
                "customer_id": customer.id if customer else None,
                "item_price_id": item_price_id,
                "created_at": subscription.created_at if subscription else None,
            }
        except Exception as e:
            raise ValueError(
                f"Failed to create subscription with item_price_id: '{item_price_id}'. "
                f"Error: {str(e)}"
            )
